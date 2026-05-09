import { FlowEvent } from "./FlowEvent";
import { FlowState } from "./FlowState";
import { transition, TransitionContext, TransitionResult } from "./transitions";

export type { TransitionContext, TransitionResult };

export class FlowConversationEngine {
  dispatch(
    state: FlowState,
    event: FlowEvent,
    ctx: TransitionContext,
  ): TransitionResult {
    return transition(state, event, ctx);
  }
}
