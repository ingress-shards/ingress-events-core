# Game Mechanics: Recursive State Portals

Recursive State Portals provide a one-time bonus to an agent's **Anomaly Unique Hack** stat. This mechanic is used in conjunction with campaigns and additional event mechanics, such as "Anomaly Uniques" scoring.

## Behaviour

During an Ingress event, some portals may enter a **Recursive State** for a specific duration.

- **No Visual Indicator**: There is no visual indicator on the Intel map or in-game scanner to identify this state.
- **Duration**: The duration varies between events; recent cases suggest a portal remains in its recursive state for the duration of an entire wave.
- **Evidence of State**: A successful hack yields a **Media item** which confirms the state was active and the size of the bonus awarded.
- **Bonus Value**: Confirmed bonus values are **10**, **13**, **31**, or **50** points.

## Interaction Properties

- The bonus is awarded exactly once per agent per recursive portal. Subsequent hacks on the same portal by the same agent will not award the bonus, even if the portal is still in its recursive state.
- Multiple agents can receive the bonus from the same portal independently.
- An agent can earn multiple unique bonuses by hacking different recursive portals across an event site.
- Agents remain eligible for the bonus as long as they are able to hack the portal (e.g., it is not burnt out). Interactions with the portal _before_ it entered its recursive state do not preclude the award of the bonus.

## Data Illustration: +Gamma Season

Niantic provided a one-off data dump for the **+Gamma season** Anomalies. This data dump is used for illustration purposes and includes:

- **Site**
- **Wave**
- **Portal GUID**
- **Bonus Value**

---

### **Related Documentation**

- [Architecture & Lifecycle](../Architecture.md)
- [Data Schema](../Schema.md)
