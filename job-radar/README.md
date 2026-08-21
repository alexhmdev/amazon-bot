# Job Radar 🛰

Encuentra vacantes remotas que **de verdad** encajan con tu perfil, las puntúa,
las guarda y te avisa por WhatsApp. Sin bots que apliquen por ti (más abajo se
explica por qué).

No aplica automáticamente: **te da una lista corta y ordenada** para que apliques
tú, bien, a las 5 que valen la pena en vez de a 200 al azar.

## Por qué así y no con un bot de "Easy Apply"

| | Bot de auto-apply (AIHawk, EasyApplyJobsBot…) | Job Radar |
|---|---|---|
| Fuente | Scraping con login de LinkedIn/Indeed | APIs públicas y feeds oficiales |
| Riesgo de cuenta | Alto: automatizar sesión viola sus términos | Ninguno: no hay login |
| Mantenimiento | Se rompe cada vez que cambia el HTML | Contratos JSON estables |
| Calidad | 200 aplicaciones genéricas → ~0 respuestas | 5 aplicaciones dirigidas |
| Riesgo de CV | Varios bots rellenan datos inventados | Tú escribes cada aplicación |

Lo que sí se automatiza es lo aburrido: buscar, filtrar, deduplicar, priorizar y
recordarte dónde vas.

## Fuentes

Todas públicas, gratuitas y sin login:

- [Jobicy](https://jobi.cy/apidocs) — la única con filtro `geo=latam`
- [We Work Remotely](https://weworkremotely.com) (feeds RSS de programación y contratos)
- [Hacker News "Who is hiring?"](https://news.ycombinator.com) — startups remotas y contratos por horas
- [Remotive](https://remotive.com/api-documentation)
- [Remote OK](https://remoteok.com/api)
- [Himalayas](https://himalayas.app/jobs/api) — trae tipo de contrato, sueldo y restricción de zona horaria
- **Bolsas oficiales de empresa** (Greenhouse / Lever / Ashby) — las vacantes salen aquí antes que en los agregadores
- Arbeitnow (Europa, apagada por defecto)

Cada resultado enlaza a la publicación original en su fuente, como piden sus términos.

## Instalación

Solo necesitas **Node 20+**. No hay dependencias que instalar.

```sh
cd job-radar
cp profile.example.json profile.json   # tu perfil
cp .env.example .env                   # opcional: avisos por WhatsApp
node src/index.js search
```

## Configura tu perfil

Todo el filtrado sale de `profile.json`. Lo importante:

| Campo | Para qué sirve |
|---|---|
| `targetTitles` | Puestos que buscas. Un match en el título vale +25 |
| `skills.core` | Tu stack real. Sin al menos 2 coincidencias, la vacante se descarta |
| `skills.nice` | Suman poco, sirven para desempatar |
| `dealbreakers.inTitleOrLocation` | Descarte duro si aparece en título o ubicación (`hybrid`, `on-site`…) |
| `dealbreakers.anywhere` | Descarte duro si aparece en cualquier parte del texto (`security clearance`…) |
| `seniority.reject` | Puestos por encima de tu nivel (`director`, `manager`…) |
| `employmentPreference` | **Clave si buscas un segundo empleo**: sube `part-time`, `contract` y `freelance` |
| `location.utcOffset` | Compara contra las zonas horarias que exige la vacante |
| `search.acceptedRegions` | Regiones donde sí te pueden contratar |
| `search.minScore` | Corte para que algo se guarde (por defecto 45) |

Los dealbreakers están separados en dos cubetas a propósito: buscar `hybrid` en
toda la descripción descarta vacantes 100% remotas que solo mencionan
"hybrid cloud".

## Cómo se calcula el score

Primero hay **descartes duros** (edad, dealbreakers, seniority y relevancia:
sin puesto objetivo ni skills tuyas, fuera). Lo que sobrevive suma y resta:

| Señal | Puntos |
|---|---|
| El título coincide con un `targetTitle` | +25 |
| Skills clave en el título | +8 c/u (máx 24) |
| Skills clave en la descripción | +5 c/u (máx 25) |
| Skills deseables | +2 c/u (máx 10) |
| Tipo de contrato preferido | según `employmentPreference` |
| Tu zona horaria está permitida / no lo está | +12 / −20 |
| Ubicación compatible / restringida a otro país | +10 / −25 |
| El anuncio dice "worldwide", "global" o "LATAM" | +12 |
| El anuncio limita el remoto a EE.UU. | −15 |
| Sueldo publicado sobre / bajo tu mínimo | +8 / −12 |
| Publicada en 48h / esta semana / hace +2 semanas | +10 / +5 / −5 |

`node src/index.js show <id>` te enseña el desglose exacto de cada vacante.

## Comandos

```sh
node src/index.js search                 # busca, puntúa, guarda y genera report.html
node src/index.js search --notify        # además manda las mejores por WhatsApp
node src/index.js search --min 60        # sube el corte
node src/index.js list --status new      # lo guardado
node src/index.js list --min 70 --source jobicy
node src/index.js show <id>              # detalle y desglose del score
node src/index.js mark <id> applied      # new | shortlist | applied | interview | rejected | discarded
node src/index.js mark <id> applied --note "referido por X"
node src/index.js letter <id>            # borrador de mensaje de aplicación
node src/index.js report                 # regenera report.html
node src/index.js stats                  # embudo y tasa de respuesta
```

El `id` se puede abreviar: basta con que sea único.

## Avisos por WhatsApp

Reusa la cuenta de Twilio del `amazon-bot`. En `.env`:

```sh
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_WHATSAPP_NUMBER=+14155238886
PHONE_TO_NOTIFY=+52...
NOTIFY_MIN_SCORE=70
```

Solo avisa una vez por vacante, y solo si supera `NOTIFY_MIN_SCORE`.

## Automatizarlo

Cron local, dos veces al día:

```sh
crontab -e
0 9,18 * * * cd /ruta/a/amazon-bot/job-radar && /usr/bin/node src/index.js search --notify >> radar.log 2>&1
```

O con GitHub Actions: ver `.github/workflows/job-radar.yml` (necesita los
secrets de Twilio en el repo).

## Datos

Todo vive en `data/jobs.json` (ignorado por git). Se escribe de forma atómica, y
`search` nunca pisa el estado que marcaste a mano.

## Rutina sugerida

1. `search --notify` corre solo dos veces al día.
2. Revisas `report.html` (5 minutos) y marcas `shortlist` lo que te late.
3. Aplicas a 3–5 al día con `letter <id>` como base, personalizando la primera línea.
4. `mark <id> applied` y `stats` cada semana para ver qué tipo de vacante te responde.

Aplicar a 5 bien > aplicar a 200 mal. Ese es todo el truco.
