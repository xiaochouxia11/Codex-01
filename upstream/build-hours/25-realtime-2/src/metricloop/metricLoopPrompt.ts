export const METRIC_LOOP_REALTIME_INSTRUCTIONS = `
# Role and Objective
You are Lighthouse, the voice analyst inside the MetricLoop product analytics dashboard for Supply Co. The user is a founder, PM, or engineer investigating ecommerce product analytics. Navigate the existing dashboard by using tools, not by describing hypothetical steps.

# Product Context
Supply Co. is an ecommerce site with voice search. The MetricLoop demo starts after a shopper searched for hiking boots, opened a product card, selected a size, and got stuck adding the item to cart. Treat all analytics data as local deterministic demo data surfaced through tools.

# Voice-To-Action Policy
- Default mode is action mode. Use tools to update the dashboard, filters, charts, session replay view, and Investigation Notebook. Do not speak aloud.
- In action mode, final output should be short text for the Action Console only, not audio narration.
- The one-word wake word for spoken replies is "Lighthouse".
- Lighthouse is also the assistant name shown in the small action console. MetricLoop remains the dashboard and product workspace name.
- Treat the wake word as valid anywhere in the user's turn, including mid-sentence: "Can you, Lighthouse, explain this out loud?"
- If speech transcription renders the wake word as "light house", treat it as "Lighthouse" only when the user is clearly asking for an out-loud explanation.
- Speak only when the latest user turn includes the Lighthouse wake word or the clear "light house" transcription variant.
- If action-only fallback mode is enabled by the client, do not speak even when the user says Lighthouse.
- Even in explain mode, use tools first when the dashboard or Notebook may be stale.
- Prefer tools over text replies. Do not narrate dashboard operations aloud.
- Never expose hidden reasoning. Show evidence, tool results, confidence, and concise conclusions.

# Happy Path
- For simple setup commands like "filter to voice", "Europe", "compare last 7 days to prior 7 days", or "first-time shoppers", call apply_filter and update the visible chips. Do not generate the Investigation Notebook yet.
- For "Why did activation drop for first-time shoppers in Europe last week?", get dashboard state, open the activation funnel, apply Europe / first-time shoppers / last 7 days filters, compare with the prior period, check releases, cluster support tickets, open representative session replays, and start a root-cause investigation.
- For "Create an engineering ticket brief", "make a report for engineering", or "show ROI", follow the same investigation path and generate the Notebook artifact. The Notebook should read like an engineering handoff with one ROI chart at the top, not a prose-only note.
- For "Actually exclude paid ads traffic and compare Mobile Safari versus Chrome", apply the paid-ads exclusion, set browser breakdown, rerun the investigation, and update the Notebook.
- For "Open the replay where the user searched for hiking boots and got stuck choosing a size", open the session replay insight and select a representative Mobile Safari footwear replay.
- For "Lighthouse, explain..." or a mid-sentence Lighthouse request, verify current dashboard state and then give a concise one- or two-sentence explanation.

# Tool Policy
- Call get_dashboard_state before making claims about the current dashboard.
- Use open_insight for visible navigation. Use one tool call per real dashboard operation.
- Use apply_filter whenever interaction type, date range, comparison, shopper segment, region, traffic source, paid ads exclusion, browser, device, product category, or event changes.
- Use set_breakdown when the user asks to compare by browser, device, traffic source, or search term.
- Use compare_periods before saying a metric dropped.
- Use check_release_notes and cluster_support_tickets before assigning likely cause.
- Use open_session_replay before citing a representative replay.
- Use start_root_cause_investigation for the hero reasoning artifact and engineering-ticket report with ROI chart.
- Use update_investigation_notebook when a follow-up changes filters, breakdowns, conclusions, or the engineering handoff.
- If the latest turn is silence, background audio, side conversation, filler, a handoff phrase, unclear audio, or unrelated to MetricLoop, call no_op. Do not speak for no_op turns.

# Cohort Forensics Policy
- For hard proof-oriented questions, such as proving whether the drop is a product bug, acquisition-quality issue, instrumentation issue, or isolated cohort problem, use the cohort forensics tools before assigning cause.
- Start with get_dashboard_state, then get_analytics_schema, then run_cohort_query with a visible SQL-like query and a structured queryPlan.
- Prefer a cohort matrix across browser, region, shopper_type, product_category, and interaction before writing a narrative conclusion.
- Test at least one confounder, such as traffic_source or paid ads, with run_cohort_query before blaming product code.
- Run run_instrumentation_check before calling something an instrumentation issue or ruling instrumentation out.
- Use run_analysis_code when ranking segments by lost activations, contribution, or drop size. The code should be a short reducer over rows and should return a compact table.
- When run_analysis_code returns needs_rewrite, rewrite the code using the provided safe execution contract and call run_analysis_code once more. Do not apologize or narrate the failure. Keep the corrected reducer short and return an array of plain row objects.
- Use render_forensics_chart when the user asks to build a chart or when a heatmap/waterfall will make the answer easier to inspect.
- Use apply_forensics_result once evidence identifies the highest-signal cohort, then summarize what changed.
- For hard proof-oriented questions, do not give the final answer until you have completed this minimum visible sequence: get_dashboard_state, get_analytics_schema, run_cohort_query, run_instrumentation_check, run_analysis_code, render_forensics_chart, and apply_forensics_result.
- The run_analysis_code step should compute a ranked top-cohort table with lost_activations, drop_pp, and a human-readable cohort label from the prior query result.
- The render_forensics_chart step should use the ranked cohort or cohort matrix result so the Action Console shows a visual artifact before the final conclusion.
- Keep the transcript clean: queries, generated code, row previews, and chart artifacts belong in the Action Console trace, not as transcript-only narration.

# Preambles
Most turns should have no spoken preamble because the Action Console is the progress surface. If an explain-mode tool flow takes noticeable time, use at most one short preamble and do not mention tool names.
For this spoken reply, begin with the answer itself. Do not say "Lighthouse" or any speaker label.
`.trim();

export const METRIC_LOOP_REALTIME_TOOLS = [
  {
    type: 'function',
    name: 'get_dashboard_state',
    description: 'Return the current MetricLoop dashboard view, visible filters, investigation board, selected replay, and safe UI targets.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {},
      required: [],
    },
  },
  {
    type: 'function',
    name: 'apply_filter',
    description: 'Update visible filter chips and rerun the dashboard for interaction type, date range, comparison, segment, region, traffic source, paid ads exclusion, browser, device, product category, or event.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        interaction: { type: 'string', enum: ['all', 'voice_search', 'typed_search', 'manual_click'] },
        dateRange: { type: 'string', enum: ['last_7_days', 'last_14_days', 'last_30_days'] },
        comparison: { type: 'string', enum: ['none', 'prior_7_days'] },
        segment: { type: 'string', enum: ['all_shoppers', 'first_time_shoppers', 'returning_shoppers'] },
        region: { type: 'string', enum: ['all', 'europe', 'north_america', 'apac'] },
        teamAge: { type: 'string', enum: ['all', 'first_time', 'returning'] },
        trafficSource: { type: 'string', enum: ['all', 'organic', 'paid_ads', 'referral'] },
        excludePaidAds: { type: 'boolean' },
        browser: { type: 'string', enum: ['all', 'mobile_safari', 'chrome', 'firefox', 'edge'] },
        device: { type: 'string', enum: ['all', 'mobile', 'desktop'] },
        productCategory: { type: 'string', enum: ['all', 'footwear', 'outerwear', 'camping'] },
        event: { type: 'string', enum: ['activation', 'voice_search_started', 'shoe_size_selected', 'add_to_cart_clicked'] },
      },
      required: [],
    },
  },
  {
    type: 'function',
    name: 'open_insight',
    description: 'Navigate to a visible product analytics insight such as the activation funnel, release correlation, browser breakdown, search intents, session replays, support themes, or Investigation Notebook.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        insightId: {
          type: 'string',
          enum: [
            'activation_funnel',
            'release_correlation',
            'browser_breakdown',
            'search_intents',
            'session_replays',
            'support_themes',
            'investigation_notebook',
          ],
        },
      },
      required: ['insightId'],
    },
  },
  {
    type: 'function',
    name: 'set_breakdown',
    description: 'Set the visible dashboard breakdown and highlight the matching chart.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        breakdown: { type: 'string', enum: ['none', 'browser', 'device', 'traffic_source', 'search_term'] },
      },
      required: ['breakdown'],
    },
  },
  {
    type: 'function',
    name: 'switch_visualization',
    description: 'Switch the active chart visualization style for the current insight.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        chartType: { type: 'string', enum: ['line', 'bar', 'funnel', 'table', 'timeline'] },
      },
      required: ['chartType'],
    },
  },
  {
    type: 'function',
    name: 'open_session_replay',
    description: 'Open or select a representative session replay for the active segment. Use this before citing replay evidence.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        browser: { type: 'string' },
        productCategory: { type: 'string', enum: ['all', 'footwear', 'outerwear', 'camping'] },
        sessionId: { type: 'string' },
        limit: { type: 'integer', minimum: 1, maximum: 5 },
      },
      required: [],
    },
  },
  {
    type: 'function',
    name: 'compare_periods',
    description: 'Compare the current funnel or activation metric with a previous period before claiming a drop.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        currentWindow: { type: 'string' },
        previousWindow: { type: 'string' },
        metric: { type: 'string' },
      },
      required: [],
    },
  },
  {
    type: 'function',
    name: 'check_release_notes',
    description: 'Check recent Supply Co. release notes that could correlate with the active segment drop.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {},
      required: [],
    },
  },
  {
    type: 'function',
    name: 'cluster_support_tickets',
    description: 'Cluster recent support-ticket themes for the active segment and expose representative ticket samples.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {},
      required: [],
    },
  },
  {
    type: 'function',
    name: 'start_root_cause_investigation',
    description: 'Generate the persistent Investigation Notebook artifact, including the engineering ticket brief and one ROI chart, from funnel, cohort, release, support, session replay, browser, and search-intent evidence.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        question: { type: 'string' },
        includeCohorts: { type: 'boolean' },
        includeReleases: { type: 'boolean' },
        includeSupportTickets: { type: 'boolean' },
        includeSessionReplays: { type: 'boolean' },
        compareBrowsers: {
          type: 'array',
          items: { type: 'string', enum: ['mobile_safari', 'chrome', 'firefox', 'edge'] },
        },
        excludePaidAds: { type: 'boolean' },
        mode: { type: 'string', enum: ['initial', 'browser_comparison'] },
      },
      required: ['question'],
    },
  },
  {
    type: 'function',
    name: 'update_investigation_notebook',
    description: 'Update the existing Investigation Notebook and engineering handoff after a follow-up filter, breakdown, replay, conclusion, or ROI framing change.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        question: { type: 'string' },
        compareBrowsers: {
          type: 'array',
          items: { type: 'string', enum: ['mobile_safari', 'chrome', 'firefox', 'edge'] },
        },
        excludePaidAds: { type: 'boolean' },
        mode: { type: 'string', enum: ['initial', 'browser_comparison'] },
      },
      required: ['question'],
    },
  },
  {
    type: 'function',
    name: 'get_analytics_schema',
    description: 'Read the MetricLoop mock analytics warehouse schema, including queryable tables, dimensions, measures, and fields for cohort forensics.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {},
      required: [],
    },
  },
  {
    type: 'function',
    name: 'run_cohort_query',
    description: 'Run a visible SQL-like cohort query using a validated structured queryPlan over the MetricLoop analytics warehouse. Use this for cohort discovery, confounder tests, and contribution analysis.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        purpose: { type: 'string' },
        query: { type: 'string' },
        queryPlan: {
          type: 'object',
          additionalProperties: false,
          properties: {
            dimensions: {
              type: 'array',
              items: {
                type: 'string',
                enum: ['browser', 'device', 'region', 'traffic_source', 'interaction', 'shopper_type', 'product_category', 'release_version'],
              },
              minItems: 1,
              maxItems: 6,
            },
            filters: {
              type: 'object',
              additionalProperties: false,
              properties: {
                browser: { type: 'string', enum: ['mobile_safari', 'chrome', 'firefox', 'edge', 'all'] },
                device: { type: 'string', enum: ['mobile', 'desktop', 'all'] },
                region: { type: 'string', enum: ['europe', 'north_america', 'apac', 'all'] },
                traffic_source: { type: 'string', enum: ['organic', 'paid_ads', 'referral', 'all'] },
                interaction: { type: 'string', enum: ['voice_search', 'typed_search', 'manual_click', 'all'] },
                shopper_type: { type: 'string', enum: ['first_time_shoppers', 'returning_shoppers', 'all'] },
                product_category: { type: 'string', enum: ['footwear', 'outerwear', 'camping', 'all'] },
                release_version: { type: 'string' },
                excludePaidAds: { type: 'boolean' },
              },
              required: [],
            },
            metric: { type: 'string', enum: ['activation_rate'] },
            orderBy: { type: 'string', enum: ['lost_activations', 'drop_pp', 'absolute_drop', 'current_activation_rate', 'prior_activation_rate'] },
            limit: { type: 'integer', minimum: 1, maximum: 50 },
          },
          required: ['dimensions'],
        },
      },
      required: ['query', 'queryPlan'],
    },
  },
  {
    type: 'function',
    name: 'run_instrumentation_check',
    description: 'Compare event volume, missing-property rate, and validation-state behavior for selected events and cohort filters.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        eventNames: {
          type: 'array',
          items: { type: 'string', enum: ['shoe_size_selected', 'add_to_cart_clicked', 'voice_search_started', 'product_card_opened'] },
          minItems: 1,
          maxItems: 4,
        },
        filters: {
          type: 'object',
          additionalProperties: false,
          properties: {
            browser: { type: 'string', enum: ['mobile_safari', 'chrome', 'firefox', 'edge', 'all'] },
            device: { type: 'string', enum: ['mobile', 'desktop', 'all'] },
            region: { type: 'string', enum: ['europe', 'north_america', 'apac', 'all'] },
            traffic_source: { type: 'string', enum: ['organic', 'paid_ads', 'referral', 'all'] },
            interaction: { type: 'string', enum: ['voice_search', 'typed_search', 'manual_click', 'all'] },
            shopper_type: { type: 'string', enum: ['first_time_shoppers', 'returning_shoppers', 'all'] },
            product_category: { type: 'string', enum: ['footwear', 'outerwear', 'camping', 'all'] },
            excludePaidAds: { type: 'boolean' },
          },
          required: [],
        },
      },
      required: ['eventNames'],
    },
  },
  {
    type: 'function',
    name: 'run_analysis_code',
    description: 'Run short generated JavaScript reducer code over a prior forensics result id to rank cohorts, compute contribution, or reshape rows. The code must return an array.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        inputResultId: { type: 'string' },
        purpose: { type: 'string' },
        code: { type: 'string' },
      },
      required: ['inputResultId', 'code'],
    },
  },
  {
    type: 'function',
    name: 'render_forensics_chart',
    description: 'Render a compact chart artifact from a prior forensics result for the Action Console trace.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        inputResultId: { type: 'string' },
        chartType: { type: 'string', enum: ['heatmap', 'waterfall', 'bar', 'table'] },
        title: { type: 'string' },
        xDimension: { type: 'string' },
        yDimension: { type: 'string' },
        valueField: { type: 'string' },
      },
      required: ['inputResultId', 'chartType', 'title'],
    },
  },
  {
    type: 'function',
    name: 'apply_forensics_result',
    description: 'Apply a selected cohort result to the visible MetricLoop dashboard filters after the evidence identifies the highest-signal segment.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        inputResultId: { type: 'string' },
        resultId: { type: 'string' },
        rowIndex: { type: 'integer', minimum: 0, maximum: 20 },
      },
      required: [],
    },
  },
  {
    type: 'function',
    name: 'no_op',
    description: 'Record that the latest audio/text turn should be ignored. This never changes dashboard state and should never be followed by spoken output.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        category: { type: 'string', enum: ['silence', 'background', 'filler', 'unclear', 'unrelated'] },
        reason: { type: 'string' },
      },
      required: ['category', 'reason'],
    },
  },
] as const;
