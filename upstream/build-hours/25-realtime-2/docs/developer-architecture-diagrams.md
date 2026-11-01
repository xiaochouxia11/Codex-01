# Supply Co. and MetricLoop Developer Architecture

This document explains how the two demo surfaces work together:

- **Supply Co.** is the shopper-facing voice commerce app.
- **MetricLoop** is the operator/developer analytics surface that investigates what happened after voice shopping sessions.

Both surfaces live in the same Vite React app and use OpenAI Realtime with strongly scoped tool definitions. Supply Co. uses browser-local deterministic tools for storefront state. MetricLoop routes tool calls through the local Vite server so analytics state, cohort forensics, safe generated-code execution, optional repair, and report updates have a server-owned boundary. The Realtime 2 prompting guidance recommends explicit tool policy, preambles, entity capture, and low reasoning effort for responsive voice agents; this app applies that pattern with `gpt-realtime-2` and `reasoning.effort = "low"`.

## Runtime Architecture

```mermaid
flowchart LR
  subgraph Browser["Browser - Vite React SPA"]
    Router["App router\n/ = Supply Co.\n/metricloop = MetricLoop"]
    SupplyUI["Supply Co. storefront\nhome, results, PDP, cart"]
    SupplyVoice["Supply Realtime hook\nuseSupplyRealtime"]
    MetricUI["MetricLoop analytics UI\ndashboards, replay, notebook"]
    MetricVoice["MetricLoop Realtime hook\nuseMetricLoopRealtime"]
    SupplyTools["Supply tool handlers\nReact state + deterministic data"]
    MetricToolClient["MetricLoop tool client\nPOST /api/metricloop/tools"]
  end

  subgraph Server["Vite preview/dev server"]
    Middleware["Realtime middleware\nvite.config.ts"]
    ClientSecret["POST /api/realtime/client-secret"]
    Calls["POST /api/realtime/calls"]
    MetricClientSecret["POST /api/realtime/metricloop/client-secret"]
    MetricCalls["POST /api/realtime/metricloop/calls\nfallback SDP proxy"]
    MetricSideband["POST /api/realtime/metricloop/sideband/register"]
    MetricTools["POST /api/metricloop/tools"]
    TraceEndpoint["POST /api/realtime-cost-traces\noptional local files"]
    ToolRuntime["MetricLoop tool runtime\nsession store + forensics"]
    RepairModel["Responses API repair\ngpt-5.4-mini optional"]
  end

  subgraph OpenAI["OpenAI Realtime API"]
    Realtime["gpt-realtime-2\nvoice + tool calls"]
    ClientSecretsEndpoint["/v1/realtime/client_secrets"]
    CallsEndpoint["/v1/realtime/calls"]
    SidebandSocket["Realtime sideband WebSocket\ncall_id"]
    ResponsesEndpoint["/v1/responses"]
  end

  Router --> SupplyUI
  Router --> MetricUI
  SupplyUI <--> SupplyVoice
  MetricUI <--> MetricVoice
  SupplyVoice <--> SupplyTools
  MetricVoice --> MetricToolClient

  SupplyVoice --> Calls
  MetricVoice --> MetricClientSecret
  MetricVoice --> CallsEndpoint
  MetricVoice -. fallback .-> MetricCalls
  MetricVoice --> MetricSideband
  MetricToolClient --> MetricTools
  ClientSecret --> ClientSecretsEndpoint
  MetricClientSecret --> ClientSecretsEndpoint
  Calls --> CallsEndpoint
  MetricCalls --> CallsEndpoint
  MetricSideband --> SidebandSocket
  MetricTools --> ToolRuntime
  ToolRuntime -. repair unsafe generated code .-> RepairModel
  RepairModel --> ResponsesEndpoint
  SupplyVoice -. usage snapshot .-> TraceEndpoint
  MetricVoice -. usage snapshot .-> TraceEndpoint
  CallsEndpoint <--> Realtime
  SidebandSocket <--> Realtime
```

## Runtime Shape

```mermaid
flowchart TD
  Repo["25-realtime-2\nVite + React + TypeScript"] --> Build["npm ci\nnpm run build"]
  Build --> Preview["npm run start\nvite preview --host 0.0.0.0"]
  Preview --> SupplyRoute["/\nSupply Co. storefront"]
  Preview --> MetricRoute["/metricloop\nMetricLoop analytics"]
  Preview --> ApiRoutes["/api/realtime/*\nNode/Vite middleware"]
  Preview --> ToolRoutes["/api/metricloop/tools\nserver runtime"]
  Preview --> TraceRoutes["/api/realtime-cost-traces\noptional local traces"]

  ApiRoutes --> OpenAI["OpenAI Realtime API"]
  ToolRoutes --> Runtime["MetricLoop session store\nforensics runtime\nsafe code runner"]
  Runtime --> Repair["Optional Responses API\ngpt-5.4-mini repair"]
  SupplyRoute --> VoiceWidget["Voice widget connects through Realtime"]
  MetricRoute --> ActionConsole["Action Console connects through Realtime"]
```

## ERD - Demo Domain Model

The app does not use a database. These entities are TypeScript objects and React state, with deterministic mock data in `src/data.ts`, `src/demoExperience.ts`, `src/reviewInsights.ts`, `src/weatherSearch.ts`, and `src/metricloop/*`.

```mermaid
erDiagram
  DEMO_PROFILE ||--o{ RECENT_PURCHASE : has
  DEMO_PROFILE ||--o{ PREFERENCE : has
  DEMO_PROFILE ||--|| SAVED_SHOE_SIZE : stores

  PRODUCT ||--o{ PRODUCT_ATTRIBUTE : has
  PRODUCT ||--o{ PRODUCT_IMAGE : has
  PRODUCT ||--o{ PRODUCT_SIZE : has
  PRODUCT ||--o{ REVIEW_INSIGHT : has
  PRODUCT ||--o{ CART_ITEM : selected_as

  CART ||--o{ CART_ITEM : contains
  CART_ITEM }o--|| PRODUCT : references

  REVIEW_INSIGHT ||--o{ REVIEW_THEME : summarizes
  REVIEW_INSIGHT ||--o{ REPRESENTATIVE_REVIEW : includes

  WEATHER_LOOKUP ||--o{ WEATHER_DAY : contains
  WEATHER_LOOKUP }o--o| PRODUCT : informs_recommendation_for

  METRIC_SESSION ||--o{ METRIC_EVENT : emits
  METRIC_SESSION }o--|| PRODUCT : involves
  METRIC_EVENT }o--|| FUNNEL_STEP : maps_to

  INVESTIGATION_BOARD ||--o{ FUNNEL_STEP : contains
  INVESTIGATION_BOARD ||--o{ SUPPORT_THEME : cites
  INVESTIGATION_BOARD ||--o{ RELEASE_NOTE : correlates
  INVESTIGATION_BOARD ||--o{ SESSION_REPLAY : cites
  INVESTIGATION_BOARD ||--o{ BROWSER_BREAKDOWN : compares
  INVESTIGATION_BOARD ||--|| ENGINEERING_BRIEF : generates

  DEMO_PROFILE {
    string name
    string preferredShoeSize
  }

  PRODUCT {
    string id
    string category
    string title
    number price
    number rating
    number reviews
    string seller
    string target
  }

  CART {
    string screenState
    number subtotal
  }

  CART_ITEM {
    string productId
    number quantity
    string size
    number price
  }

  REVIEW_INSIGHT {
    string productId
    number averageRating
    number reviewCount
    string headline
  }

  WEATHER_LOOKUP {
    string location
    string dateText
    string stormRisk
    string recommendation
  }

  METRIC_SESSION {
    string id
    string shopper
    string browser
    string device
    string region
  }

  METRIC_EVENT {
    string type
    string status
  }

  INVESTIGATION_BOARD {
    string id
    string question
    string conclusion
    string confidence
  }

  ENGINEERING_BRIEF {
    string title
    string priority
    string owner
    number estimatedWeeklyRevenueRecovery
  }
```

## Supply Co. Realtime Session Setup

```mermaid
sequenceDiagram
  participant UI as React UI
  participant Hook as useSupplyRealtime
  participant Server as Vite Middleware
  participant OAI as OpenAI Realtime API
  participant Model as gpt-realtime-2

  UI->>Hook: User opens voice assistant
  Hook->>Server: POST /api/realtime/calls with SDP offer
  Server->>OAI: POST /v1/realtime/calls with session config
  Note over Server,OAI: Supply session includes instructions, tools, audio config, voice, reasoning.effort low, and automatic VAD response creation
  OAI-->>Server: SDP answer
  Server-->>Hook: SDP answer
  Hook->>Hook: Establish WebRTC peer connection
  Hook->>Model: session.update over data channel
  Note over Hook,Model: Browser refreshes session config and registers optional local usage trace metadata
  Model-->>Hook: session.updated
  Hook-->>UI: Status becomes listening
```

## MetricLoop Realtime Session Setup

```mermaid
sequenceDiagram
  participant UI as MetricLoop UI
  participant Hook as useMetricLoopRealtime
  participant Server as Vite Middleware
  participant OAI as OpenAI Realtime API
  participant Sideband as Server Sideband
  participant Model as gpt-realtime-2

  UI->>Hook: User opens Lighthouse
  Hook->>Server: POST /api/realtime/metricloop/client-secret
  Server->>OAI: POST /v1/realtime/client_secrets
  Note over Server,OAI: Request includes short expiry, MetricLoop session config, and OpenAI-Safety-Identifier
  OAI-->>Server: client_secret.value
  Server-->>Hook: Ephemeral client secret
  Hook->>OAI: POST /v1/realtime/calls with SDP offer and client secret
  alt Direct browser call succeeds
    OAI-->>Hook: SDP answer + Location call id
    Hook->>Server: POST /api/realtime/metricloop/sideband/register
    Server->>Sideband: Open WebSocket with call_id
    Sideband<->>Model: Attach to same Realtime session
  else Direct browser call fails
    Hook->>Server: POST /api/realtime/metricloop/calls with SDP offer
    Server->>OAI: POST /v1/realtime/calls with server API key
    OAI-->>Server: SDP answer
    Server-->>Hook: SDP answer
  end
  Hook->>Hook: Establish WebRTC peer connection
  Hook->>Model: session.update over data channel
  Note over Hook,Model: MetricLoop keeps turn_detection.create_response=false; the app decides when to send response.create
  Model-->>Hook: session.updated
  Hook-->>UI: Status becomes listening
```

## Supply Co. Tool-Call Flow

```mermaid
sequenceDiagram
  participant Shopper
  participant Model as gpt-realtime-2
  participant Hook as useSupplyRealtime
  participant Tools as Supply Agent Context
  participant UI as Storefront UI
  participant Data as Local Data

  Shopper->>Model: "Find a 3 to 4 person tent under 450"
  Model-->>Shopper: Commentary preamble: "I'll narrow those options."
  Model->>Hook: function_call search_products
  Hook->>Tools: searchProducts({ category: "tent" })
  Tools->>UI: screen = results, category = tent
  Tools-->>Hook: SupplyActionResponse

  Model->>Hook: function_call apply_filters
  Hook->>Tools: applyFilters({ maxPrice: 450 })
  Tools->>Data: filter products
  Tools->>UI: update chips and visible products
  Tools-->>Hook: SupplyActionResponse

  Model->>Hook: function_call highlight_products
  Hook->>Tools: highlightProducts({ count: 2 })
  Tools->>UI: highlight product cards
  Tools-->>Hook: highlighted product summaries

  Hook->>Model: conversation.item.create with tool outputs
  Hook->>Model: response.create after tools complete
  Model-->>Shopper: Final answer recommends visible highlighted products
```

## Supply Co. Happy Path Tool Map

```mermaid
flowchart TD
  Start["Trip planning request"] --> Needs["get_hiking_needs"]
  Needs --> TentSearch["search_products category=tent"]
  TentSearch --> TentFilters["apply_filters maxPrice=450"]
  TentFilters --> TentHighlight["highlight_products count=2"]
  TentHighlight --> ReviewQuestion{"Ask about bad reviews?"}
  ReviewQuestion -->|yes| ReviewTool["summarize_product_reviews focus=critical"]
  ReviewQuestion -->|no| AddTent
  ReviewTool --> WeatherQuestion{"Ask about Seattle storm risk?"}
  WeatherQuestion -->|yes| WeatherTool["search_weather_web location=Seattle date=weekend after next"]
  WeatherQuestion -->|no| AddTent
  WeatherTool --> AddTent["add_to_cart tent after explicit confirmation"]
  AddTent --> ShoeProfile["get_saved_profile returns US 10"]
  ShoeProfile --> ShoeSearch["search_products category=shoe"]
  ShoeSearch --> ShoeFilters["apply_filters shoeSize=US 10"]
  ShoeFilters --> ShoeHighlight["highlight_products count=2"]
  ShoeHighlight --> ShoeReview["summarize_product_reviews focus=critical"]
  ShoeReview --> SelectSize["select_shoe_size US 10"]
  SelectSize --> AddShoe["add_to_cart shoe size=US 10"]
  AddShoe --> Cart["go_to_cart"]
  Cart --> End["Stop at cart review"]
```

## Supply Co. Tool Catalog

| Tool | Purpose | Reads/Writes |
|---|---|---|
| `get_hiking_needs` | Returns missing gear for the weekend trail kit | Read-only deterministic response |
| `get_saved_profile` | Returns the demo shopper, saved US 10, preferences, recent purchases | Read-only deterministic profile |
| `get_screen_state` | Captures current screen, filters, cart, visible products, safe targets | Read-only React state |
| `search_products` | Navigates to results and sets active category | Writes React screen/category state |
| `apply_filters` | Applies max price, shoe size, shipping, Supply-ready, sort | Writes filter state |
| `highlight_products` | Highlights cards/targets and returns selected product summaries | Writes highlight state |
| `open_product` | Opens PDP from product id, target id, or visible index | Writes selected product/screen state |
| `select_quantity` | Sets PDP quantity | Writes quantity state |
| `select_shoe_size` | Selects US shoe size on PDP | Writes selected shoe size |
| `open_size_guide` | Opens the PDP size guide | Writes size-guide UI state |
| `close_size_guide` | Closes the PDP size guide | Writes size-guide UI state |
| `add_to_cart` | Adds confirmed item to cart | Writes cart state |
| `summarize_product_reviews` | Summarizes synthetic product reviews | Reads local review insight data |
| `search_weather_web` | Checks weather forecast and storm risk | Calls Open-Meteo with local fallback |
| `go_to_cart` | Navigates to cart review | Writes screen state |
| `go_home` | Navigates to homepage | Writes screen state |
| `clear_filters` | Clears result filters | Writes filter state |

## MetricLoop Tool-Call Flow

```mermaid
sequenceDiagram
  participant Operator
  participant Policy as Turn Policy
  participant Model as gpt-realtime-2
  participant Hook as useMetricLoopRealtime
  participant Server as /api/metricloop/tools
  participant Tools as Server Tool Runtime
  participant UI as MetricLoop UI
  participant Data as Mock Analytics Data

  Operator->>Policy: "Why did activation drop for first-time shoppers in Europe last week?"
  Policy-->>Hook: mode=action, shouldSpeak=false
  Hook->>Model: response.create with text-only output
  Model->>Hook: function_call apply_filter
  Hook->>Server: apply_filter({ segment, region, dateRange })
  Server->>Tools: runTool(sessionId, apply_filter)
  Tools->>UI: update filter chips
  Server-->>Hook: tool output
  Hook->>Model: conversation.item.create function_call_output

  Model->>Hook: function_call compare_periods
  Hook->>Server: compare_periods()
  Server->>Tools: comparePeriods()
  Tools->>Data: activation funnel current vs prior
  Server-->>Hook: tool output
  Hook->>Model: conversation.item.create function_call_output

  Model->>Hook: function_call check_release_notes
  Hook->>Server: check_release_notes()
  Server->>Tools: checkReleaseNotes()
  Tools->>Data: correlated PDP size selector release
  Server-->>Hook: tool output
  Hook->>Model: conversation.item.create function_call_output

  Model->>Hook: function_call cluster_support_tickets
  Hook->>Server: cluster_support_tickets()
  Server->>Tools: clusterSupportTickets()
  Tools->>Data: support themes
  Server-->>Hook: tool output
  Hook->>Model: conversation.item.create function_call_output

  Model->>Hook: function_call open_session_replay
  Hook->>Server: open_session_replay()
  Server->>Tools: openSessionReplay()
  Tools->>UI: select representative replay
  Server-->>Hook: tool output
  Hook->>Model: conversation.item.create function_call_output

  Model->>Hook: function_call start_root_cause_investigation
  Hook->>Server: start_root_cause_investigation()
  Server->>Tools: startRootCauseInvestigation()
  Tools->>Data: build investigation board
  Tools->>UI: render notebook, ROI chart, engineering brief

  Hook->>Model: tool outputs
  Hook->>UI: Action Console shows trace
  Note over Model,UI: In action mode, tool output is visible but no spoken narration is needed
```

## MetricLoop Tool Map

```mermaid
flowchart TD
  Ask["Operator asks analytics question"] --> Policy{"Wake word MetricLoop?"}
  Policy -->|no| ActionMode["Action mode\ntext/tools only"]
  Policy -->|yes| ExplainMode["Explain mode\naudio allowed"]

  ActionMode --> State["get_dashboard_state"]
  ExplainMode --> State
  State --> Filters["apply_filter"]
  Filters --> Insight["open_insight"]
  Insight --> Compare["compare_periods"]
  Compare --> Release["check_release_notes"]
  Compare --> Support["cluster_support_tickets"]
  Compare --> Replay["open_session_replay"]
  Release --> Investigation["start_root_cause_investigation"]
  Support --> Investigation
  Replay --> Investigation
  Investigation --> Notebook["Investigation Notebook\nconclusion, confidence, ROI chart, ticket brief"]
  Notebook --> Variation{"User changes slice?"}
  Variation -->|exclude paid ads or compare browsers| Breakdown["set_breakdown / apply_filter"]
  Breakdown --> Update["update_investigation_notebook"]
  Update --> Notebook
  Notebook --> DeepDive{"Run deeper analysis?"}
  DeepDive -->|yes| Schema["get_analytics_schema"]
  Schema --> Cohort["run_cohort_query"]
  Cohort --> Instrumentation["run_instrumentation_check"]
  Instrumentation --> Code["run_analysis_code"]
  Code --> Chart["render_forensics_chart"]
  Chart --> Apply["apply_forensics_result"]
  Apply --> Notebook

  Ask --> NoOp{"Silence, filler, unrelated, unclear?"}
  NoOp -->|yes| NoOpTool["no_op"]
```

## MetricLoop Tool Catalog

| Tool | Purpose | Reads/Writes |
|---|---|---|
| `get_dashboard_state` | Returns current dashboard, filters, board, replay, safe targets | Read-only UI state |
| `apply_filter` | Updates interaction/date/segment/region/browser/device/event filters | Writes dashboard filter state |
| `open_insight` | Navigates to an insight panel | Writes active view/highlight |
| `set_breakdown` | Sets dashboard breakdown by browser/device/source/search term | Writes chart breakdown |
| `switch_visualization` | Changes chart display type | Writes chart type |
| `open_session_replay` | Selects representative replay evidence | Writes selected replay |
| `compare_periods` | Compares funnel or activation metric windows | Reads deterministic analytics data |
| `check_release_notes` | Finds correlated release notes | Reads mock release data |
| `cluster_support_tickets` | Clusters support themes | Reads mock support data |
| `start_root_cause_investigation` | Builds persistent Investigation Notebook artifact | Writes investigation board |
| `update_investigation_notebook` | Updates notebook after filter/breakdown changes | Writes investigation board |
| `get_analytics_schema` | Returns allowed mock warehouse tables, dimensions, and measures | Reads server-side schema contract |
| `run_cohort_query` | Executes a validated cohort query plan over mock warehouse rows | Writes session-scoped result ids |
| `run_instrumentation_check` | Checks event health, missing properties, and validation behavior | Writes session-scoped result ids |
| `run_analysis_code` | Validates and runs generated reducer code over prior result rows | Writes analysis result ids; may request repair |
| `render_forensics_chart` | Builds an inspectable chart artifact from prior result rows | Writes chart artifact |
| `apply_forensics_result` | Applies highest-signal forensics evidence to dashboard filters and notebook | Writes dashboard filters and investigation board |
| `no_op` | Handles silence/filler/unclear/unrelated turns | No UI mutation |

## Realtime Event Handling Pattern

```mermaid
stateDiagram-v2
  [*] --> Idle
  Idle --> Connecting: user opens voice
  Connecting --> Listening: WebRTC + data channel open
  Listening --> UserTurn: audio transcription completed
  UserTurn --> ModelResponding: response.create
  ModelResponding --> ToolCall: response.output_item.done function_call
  ToolCall --> ToolRunning: parse args + dispatch browser or server handler
  ToolRunning --> ToolOutputSent: conversation.item.create function_call_output
  ToolOutputSent --> ModelResponding: response.create after tools complete
  ModelResponding --> Listening: response.done
  ModelResponding --> Error: error event
  ToolRunning --> Error: tool failure
  Error --> Idle: disconnect/reset
```

## Key Implementation Notes

- `src/realtimeSessionConfig.ts` centralizes Realtime session shape: model, instructions, tools, `reasoning`, audio transcription, output voice, and optional semantic VAD.
- `vite.config.ts` provides local middleware for Realtime client secrets, WebRTC calls, MetricLoop sideband registration, server-owned MetricLoop tools, optional Realtime cost traces, and optional generated-code repair through the Responses API. Any hosted version must run the Node/Vite server, not a static-only asset server.
- Supply Co. uses `turnDetection.create_response = true` because it behaves like a conversational shopping assistant.
- MetricLoop uses `turnDetection.create_response = false` and manually classifies turns so dashboard actions can be text/tool-only unless the wake word asks for spoken explanation.
- Supply Co. tools are browser-local deterministic functions. MetricLoop tools are invoked through `/api/metricloop/tools`, backed by a local server runtime, mock analytics warehouse, session store, demo-only generated-code validator, and deterministic fallbacks.
- MetricLoop's preferred connection path uses a short-lived client secret for the browser Realtime call and registers a server sideband when a call id is available. The local calls proxy remains as a demo fallback.
- `OPENAI_SAFETY_IDENTIFIER` controls the stable non-PII safety identifier attached to Realtime client-secret creation. `ENABLE_REALTIME_COST_TRACES=1` enables local trace persistence under `output/realtime-cost-traces`.
- The UI intentionally shows tool progress: Supply Co. in the assistant panel; MetricLoop in the Action Console and Investigation Notebook.
- The cart and analytics data are in-memory for the demo. Refreshing the page resets state.
