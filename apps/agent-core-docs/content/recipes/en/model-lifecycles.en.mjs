// English prose for the matching scenario source; code and symbol matches have one owner.
export default {
  "model-protocol-provider": {
    "title": "Connect a model through an explicit protocol",
    "summary": "Connect a model through an explicit protocol.",
    "details": "The protocol catalog describes protocol expressibility, not tool authorization or verified endpoint capabilities. The injected fetch below is offline; Runner still owns budgets, cancellation and terminal validation.",
    "examples": [
      {
        "title": "Connect and inspect the result",
        "level": "Configuration"
      }
    ],
    "policyTitles": []
  },
  "model-scoped-input": {
    "title": "Ordered resource preparation and scoped continuation",
    "summary": "Ordered resource preparation and scoped continuation.",
    "details": "Resource authorization and reads are host ports; preparation is a bounded zero-generation action. Continuation is serializable protocol/model/scope-bound data, not editable prose. History anchors and native private blocks must be preserved. The memory store is not cross-process persistence.",
    "examples": [
      {
        "title": "Connect and inspect the result",
        "level": "Configuration"
      }
    ],
    "policyTitles": []
  },
  "model-background-batch": {
    "title": "Submit, wait and reconcile background or batch operations",
    "summary": "Submit, wait and reconcile background or batch operations.",
    "details": "Generation, background work and Batch have distinct lifecycles. The host supplies current authorization, atomic reserve/save and the existing Runner run port. Acceptance is not completion; unknown submissions are never silently retried. Waiting has explicit query and interval bounds. The low-level HTTP adapter preserves protocol actions; higher-level adapters compile messages or batch items.",
    "examples": [
      {
        "title": "Connect and inspect the result",
        "level": "Configuration"
      }
    ],
    "policyTitles": []
  },
  "model-realtime-session": {
    "title": "Realtime sessions and raw frame lifecycles",
    "summary": "Realtime sessions and raw frame lifecycles.",
    "details": "openProtocolRealtime handles protocol tool groups and explicit generations. Raw frame consumers can instead pair createRealtimeProtocolProvider with openModelRealtime. These are alternative abstraction levels, not two connections for one task. Inputs and tool results still require current authorization; interruption cannot undo completed effects.",
    "examples": [
      {
        "title": "Connect and inspect the result",
        "level": "Configuration"
      }
    ],
    "policyTitles": []
  },
  "model-realtime-wire": {
    "title": "Associate realtime inputs and tool results",
    "summary": "Associate realtime inputs and tool results.",
    "details": "These helpers construct frames; they neither execute nor authorize tools. Use actual received call IDs and names. Gemini FunctionResponse requires an object, so scalar values are normalized. Prefer the high-level session.tool path for grouped continuation and budgeting.",
    "examples": [
      {
        "title": "Connect and inspect the result",
        "level": "Configuration"
      }
    ],
    "policyTitles": []
  },
  "model-realtime-connectors": {
    "title": "Bounded WebSocket and host WebRTC connectors",
    "summary": "Bounded WebSocket and host WebRTC connectors.",
    "details": "Connectors bound queued frames, frame characters and buffered output bytes. Wrap an existing socket or establish a WebSocket connection. WebRTC SDP exchange and media devices remain host-owned; local transport tests do not prove remote vendor or media quality.",
    "examples": [
      {
        "title": "Connect and inspect the result",
        "level": "Configuration"
      }
    ],
    "policyTitles": []
  }
};
