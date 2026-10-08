# Presenter guide · 3–5 minutes

1. **Set the stakes (30 seconds).** Open the presenter view. Point to the deck's 3:40 pm sell order: 400K shares sold, 250K on loan, T+1 settlement. Explain that the remaining 150K are assumed available in this demonstration.
2. **Join (30 seconds).** Display the canonical QR or copy link. Ask five participant devices to join as Portfolio team, Lending desk, Prime broker A, Prime broker B, and Custodian. Show the live device badges, waiting count, and assigned roles. The presenter unlocks controls with the private PIN.
3. **Start the recall (60 seconds).** Portfolio records the sale. Lending desk issues the 250K share recall. Point to the newly animated path and shared event log after each accepted action. Explain that the deck contrasts this with an evening batch, but the demo does not measure elapsed time.
4. **Resolve returns (60 seconds).** Broker A returns 150K; Broker B returns 100K. They may act in either order. After the first return, show the still-open 100K shortfall. Explain that Hyper-0x cannot force a borrower to deliver shares it lacks.
5. **Confirm and close (45 seconds).** Custodian confirms delivery. Lending desk records a collateral-release instruction without an invented collateral amount. Custodian records 400K shares delivered for T+1 settlement. Show the accepted action log and finished status.
6. **Compare and invite questions (30 seconds).** The two process views describe coordination around the same actions. The shared column is the live simulated record; the conventional column is illustrative, not a timed benchmark. The deck proposes testing recall lead time, late returns, fail costs, and lending income in a shadow-mode pilot.

For another run, use **Reset run**. To demonstrate recovery, refresh a participant page or kick one device and ask it to rejoin, then choose an available role. Animations are only for newly accepted actions and do not replay after refresh.
