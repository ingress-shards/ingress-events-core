#!/usr/bin/env python3

import json
import time
import datetime as dt
import requests
import requests_cache
import re
import pandas as pd
import reverse_geocoder as rg
from unidecode import unidecode
import os
import sys
from timezonefinder import TimezoneFinder
from concurrent.futures import ThreadPoolExecutor

# Ensure UTF-8 output
if sys.stdout.encoding.lower() != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except AttributeError:
        pass # Older python

# Cache for 1 hour
requests_cache.install_cache('cache', expire_after=3600)

SEASON_MANIFEST_FILENAME = 'season_manifest.json'
SEASON_GEOCODE_FILENAME = 'season_geocode.json'

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
SEASON_MANIFEST_FILE_PATH = os.path.join(SCRIPT_DIR, '..', 'conf', SEASON_MANIFEST_FILENAME)
with open(SEASON_MANIFEST_FILE_PATH, 'r', encoding="utf-8") as f:
    season_manifest = json.load(f)

EVENT_MARKER_REGEX = r"L.marker\(\[(?P<lat>-?\d+.\d+), (?P<lng>-?\d+.\d+)\]\).bindPopup\('(?P<type>Shard Skirmish|Anomaly)<br /> ?(?P<name>.+?)<br />(?P<date>.+?)'\)"

PACKAGE_JSON_PATH = os.path.join(SCRIPT_DIR, '..', 'package.json')
with open(PACKAGE_JSON_PATH, 'r', encoding='utf-8') as f:
    package_version = json.load(f).get('version', '0.0.0')
print(f'Package version: {package_version}')

# Headers to simulate a real browser request
HEADERS = {
    'User-Agent': f'ingress-events-core/{package_version}',
    "accept-language": "en-US,en;q=0.9",
}

LABEL_TO_EVENT_TYPE = {
    "Anomaly": "ANOMALY",
    "Shard Skirmish": "SKIRMISH"
}

tf = TimezoneFinder()

def get_country_code_offline(row):
    """Returns ISO country code based on E6 coordinates."""
    result = rg.search((row['latE6']/1e6, row['lngE6']/1e6), mode=1)
    country_code = result[0].get('cc')
    return country_code.upper() if country_code else None

def slugify(text):
    """Converts a string into a URL-style slug."""
    # unidecode handles accented characters, unidecode("São Paulo") -> "Sao Paulo"
    slug = unidecode(str(text)).lower()
    # Remove non-alphanumeric (except spaces/hyphens)
    slug = re.sub(r'[^\w\s-]', '', slug)
    # Replace whitespace/underscores with single hyphen
    slug = re.sub(r'[\s_-]+', '-', slug).strip('-')
    return slug

def get_zoned_timestamp(row):
    """Combines a naive datetime and a timezone into a Zoned ISO string."""
    dt_naive = row["date"]
    tz_name = row["timeZone"]
    if tz_name:
        try:
            iso_base = dt_naive.strftime('%Y-%m-%dT%H:%M:%S')
            return f"{iso_base}[{tz_name}]"
        except Exception as e:
            print(f"Error formatting zoned timestamp: {e}")

    return dt_naive.strftime('%Y-%m-%dT%H:%M:%S')

def get_start_time(row, season_config):
    """Looks up the blueprint start time for an event type and merges it with the date."""
    event_type = row['eventType']
    components = season_config.get('components', [])
    config = next((c for c in components if c.get('eventType') == event_type), {})
    start_time_str = config.get('startTime', '00:00')
    date_only = row['date'].strftime('%Y-%m-%d')
    return pd.to_datetime(f"{date_only} {start_time_str}")

def process_season(season):
    """Processes all sites for a single anomaly season."""
    try:
        season_id = season.get("id")
        season_name = season.get("name")
        overview_url = season.get("overviewUrl")
        season_components = season.get("components")
        df = pd.DataFrame()

        # Phase 1: Data Gathering (Intel Overview)
        if overview_url:
            r = requests.get(overview_url, headers=HEADERS)
            found = re.findall(EVENT_MARKER_REGEX, r.text)
            if found:
                site_df = pd.DataFrame(found, columns=["lat", "lng", "type", "name", "date"])
                site_df["latE6"] = (site_df["lat"].astype(float) * 1e6).round().astype(int)
                site_df["lngE6"] = (site_df["lng"].astype(float) * 1e6).round().astype(int)
                site_df['eventType'] = site_df['type'].map(LABEL_TO_EVENT_TYPE)
                site_df["date"] = pd.to_datetime(site_df["date"], format='%d %b %Y')
                site_df = site_df.drop(columns=['lat', 'lng', 'type'])
                df = site_df

        # Phase 2: Data Gathering (Manifest Overrides/Schedule)
        if season_components:
            site_rows = []
            for component in season_components:
                event_type = component.get("eventType")
                schedule = component.get("schedule")
                if schedule:
                    for entry in schedule:
                        entry_date = entry.get("date")
                        sites = entry.get("sites", [])
                        for site_config in sites:
                            latE6 = site_config.get("latE6")
                            lngE6 = site_config.get("lngE6")
                            name = site_config.get("name")
                            if latE6 is not None and lngE6 is not None:
                                site_rows.append({
                                    "latE6": int(latE6),
                                    "lngE6": int(lngE6),
                                    "name": name,
                                    "eventType": event_type,
                                    "date": pd.to_datetime(entry_date, format='%Y-%m-%d')
                                })
            if site_rows:
                schedule_df = pd.DataFrame(site_rows)
                df = pd.concat([df, schedule_df], ignore_index=True)

        if df.empty:
            return season_id, []

        # Phase 3: ID Generation & De-duplication
        # Use only the city name for the primary slug (e.g. 'Singapore, SG' -> 'singapore')
        df["base_id"] = df.apply(lambda r: f"{season_id}-{slugify(str(r['name']).split(',')[0])}", axis=1)
        
        # Identify sites with same base ID in the same season (rare, but happens with events in the same location on different days)
        is_duplicate = df["base_id"].duplicated(keep=False)
        
        def finalize_id(row):
            if is_duplicate[row.name]:
                date_suffix = row['date'].strftime('%Y%m%d')
                return f"{row['base_id']}-{date_suffix}"
            return row['base_id']

        df["id"] = df.apply(finalize_id, axis=1)
        df = df.drop(columns=["base_id"])

        # Phase 4: Temporal & Geographic Enrichment
        if 'components' in season:
            df['date'] = df.apply(lambda r: get_start_time(r, season), axis=1)
            
        df["timeZone"] = df.apply(lambda r: tf.timezone_at(lng=r["lngE6"]/1e6, lat=r["latE6"]/1e6), axis=1)
        df["startTime"] = df.apply(get_zoned_timestamp, axis=1)
        df["countryCode"] = df.apply(get_country_code_offline, axis=1)
        df = df.drop(columns=["date"])
        
        # Final cleanup and export
        df = df[["id", "name", "latE6", "lngE6", "eventType", "startTime", "timeZone", "countryCode"]]
        print(f'{season_name} - {len(df)} sites geocoded')
        return season_id, df.to_dict(orient="records")

    except Exception as e:
        # Use season.get('label') or season.get('name') for log output
        display_name = season.get('label') or season.get('name') or "Unknown"
        print(f"Error in process_season {display_name}: {e}")
    
    return season.get("id"), []

# Filter geocode and manifest data to the last 90 days
def filter_recent_data(season_geocode, season_manifest):
    ninety_days_ago = dt.datetime.now() - dt.timedelta(days=90)

    geocode_recent = { "seasons": [] }
    manifest_recent = { "seasons": [] }
    total_sites_recent = 0

    for season in season_geocode['seasons']:
        season_id = season['id']
        sites = season['sites']
        recent_sites = [site for site in sites if dt.datetime.strptime(site['startTime'].split('[')[0], '%Y-%m-%dT%H:%M:%S') >= ninety_days_ago]
        if recent_sites:
            geocode_recent['seasons'].append({'id': season_id, 'sites': recent_sites})
            total_sites_recent += len(recent_sites)
            
            # Sub-filter Manifest
            matched_season = next((s for s in season_manifest['seasons'] if s['id'] == season_id), None)
            if matched_season:
                manifest_recent['seasons'].append(matched_season)

    print(f'Recent data: {total_sites_recent} sites, {len(manifest_recent["seasons"])} seasons from last 90 days')
    return geocode_recent, manifest_recent

def save_generated_data(season_geocode_full, season_geocode_recent, season_manifest_recent):
    # 1. Save Full Geocode
    geocode_file_path = os.path.join(SCRIPT_DIR, '..', 'gen', 'conf', SEASON_GEOCODE_FILENAME)
    save_to_file(season_geocode_full, geocode_file_path)

    # 2. Save Recent Filtered Geocode
    recent_file_path = os.path.join(SCRIPT_DIR, '..', 'gen', 'conf', 'recent', SEASON_GEOCODE_FILENAME)
    save_to_file(season_geocode_recent, recent_file_path)

    # 3. Save Recent Manifest
    recent_manifest_path = os.path.join(SCRIPT_DIR, '..', 'gen', 'conf', 'recent', SEASON_MANIFEST_FILENAME)
    save_to_file(season_manifest_recent, recent_manifest_path)

def save_to_file(data, file_path):
    os.makedirs(os.path.dirname(file_path), exist_ok=True)
    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=None, ensure_ascii=False)
    

def main():
    start_time = time.time()
    
    # Pre-loading reverse geocoder database
    print("Pre-loading geocoder database...")
    rg.search((0, 0), mode=1)

    # Using 1 worker for stability on Windows (cache makes it fast enough)
    with ThreadPoolExecutor(max_workers=1) as executor:
        results = list(executor.map(process_season, season_manifest['seasons']))

    season_geocode_full = { "seasons": [] }
    total_sites_full = 0
    for season_id, site_data in results:
        season_geocode_full["seasons"].append({ "id": season_id, "sites": site_data })
        total_sites_full += len(site_data)

    print(f'Geocoded {total_sites_full} sites, {len(season_geocode_full["seasons"])} seasons.')

    season_geocode_recent, season_manifest_recent = filter_recent_data(season_geocode_full, season_manifest)

    save_generated_data(season_geocode_full, season_geocode_recent, season_manifest_recent)

    end_time = time.time()
    elapsed_time = end_time - start_time
    
    print(f'Time elapsed: {elapsed_time:.2f} seconds.')

if __name__ == '__main__':
    main()
