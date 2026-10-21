# Reference-Led App Redesign Design

## Goal

Extend the approved Home-screen direction across WaveXOne without changing its trading content, navigation model, or backend behavior. The visual reference supplies the composition and atmosphere: an immersive American-blue upper field, heavy navy structural surfaces, white reading surfaces, black navigation, and restrained gold for the selected or highest-priority state.

## Design system

- Blue is the dominant visual field, not a small accent. Primary screens open inside the existing atmospheric blue treatment.
- Navy creates the product structure: account summaries, market summaries, trading context, grouped actions, and section containers.
- White is reserved for dense reading and form areas where dark text improves clarity.
- Black anchors the persistent tab dock and the deepest contrast surfaces.
- Gold is scarce. It marks the active tab, selected filters, the primary trading action, positive emphasis that is not semantic profit, and focused controls.
- Existing green/red profit and loss semantics remain unchanged.
- Screens use the same spacing, radius, typography, and elevation vocabulary through shared design-system components; no screen-local imitation of the reference.

## Screen mapping

### Primary tabs

- **Markets:** blue title/search area, navy market-summary block, gold selected filter, highly legible instrument list.
- **Trade:** blue context header, navy quote/price hero, white order-entry body, gold submit emphasis.
- **Positions:** blue header, navy P&L and exposure summary, readable white position rows, gold selected scope.
- **Account / More:** blue identity header, navy shortcut panel, white grouped settings and account rows.

### Supporting screens

- Balance, Activity, Signals, Notifications, Profile, and Settings use the shared blue-header/content-sheet shell.
- Instrument detail keeps the chart and market data visually dominant within a blue/navy hierarchy.
- Loading, empty, and error states inherit the same shell and remain accessible.

### Route-based sheets

Deposit, withdrawal, transfer, order ticket, order modification, account switching, instrument selection, and phone editing retain native route behavior. Their visible body uses a navy title band with a gold grabber or selected treatment and a white form surface.

## Interaction constraints

- Preserve React Navigation stacks and the custom floating Trade tab.
- Preserve every existing action, backend query, mutation, confirmation, native action menu, and accessibility label.
- Do not add inert decorative controls.
- Do not copy banking labels, balances, cards, or transactions from the reference.
- Use existing design-system exports in screens; screens do not import React Native text, pressable, or image primitives directly.
- Optimize for compact phone layouts and avoid visual effects that harm list performance.

## Verification

Behavioral structure is protected with focused Jest tests. Final verification includes typecheck, Expo lint, the full test suite, `git diff --check`, and representative phone-size visual inspection of each screen family.
