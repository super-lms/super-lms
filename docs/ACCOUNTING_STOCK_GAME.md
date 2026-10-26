# Accounting 11 stock market game

## Purpose

A classroom simulation for up to 60 students in an actual SUPER-LMS class/cohort. The suggested duration is two calendar months. All account amounts are CAD. No money is invested, and the application does not connect to a broker or a price feed.

Students look up Canadian stock prices themselves. A price-source URL is required for each trade and daily price; daily explanations are required, with an optional separate research/news URL. Sources are links for the teacher to inspect, not data automatically retrieved or verified by SUPER-LMS.

## Teacher setup

1. Open **Stock Market Game** from the teacher/admin menu.
2. Select **Accounting 11 for Grade 12s** (or the actual intended class/cohort).
3. Choose **Create stock game**. Enter the name and start date; the end date defaults to two months later.
4. Select the Canadian market price date for the first session. Use a completed trading day, checking weekends and exchange holidays.
5. Create the game. Students join from **Stock Market Game** in their Student Portal.

Only teachers assigned to the course, its master course, or a co-teaching role can manage the game; admin access is restricted to the same school. Students must be enrolled in a live course and can only access their own portfolio, transactions, research, and weekly statements. The class equity tally is visible to participants.

## Game rules

- Start with $100,000 CAD in cash as owner capital, not a loan.
- The initial purchase contains exactly 10 different stocks. Use a Canadian listing symbol ending in `.TO` or `.V`.
- Every buy or sell costs $10. The initial 10 orders therefore cost $100 in fees, leaving at most $99,900 for shares.
- Hold no more than 10 different stocks at a time. Selling part of a holding does not free a stock slot; selling the whole holding does.
- Shares may be fractional to six decimal places in this simulation. Prices support four decimal places; cash and trade amounts are rounded to cents using integer arithmetic.
- No overdrafts, loans, short-selling, interest, dividends, or tax calculations.
- This first version models share-price changes and trades. It does not automatically adjust for stock splits, mergers, or reorganizations. Explain that rule at the start; a corporate action affecting a chosen stock needs teacher review before finalizing results.
- Recorded trades are permanent. Students confirm before recording, so they must check symbols, quantities and prices carefully.

## Daily student workflow

1. Check the class price date and look up that day's CAD prices for the Canadian listings.
2. Record any buy or sell, using its price-source URL and a trade reason.
3. Enter prices for every stock currently held and explain why its price rose, fell or stayed flat. Identify hypotheses rather than presenting them as proven news.
4. Save **Daily valuation and research**. Revalue after trading, because trading changes cash or holdings.
5. Review the calculated cash, investment value and equity.

Trading is available during the configured start/end dates using China time. Students can save valuations and weekly work after trading ends, until the teacher finalizes the game. The price date refers to the Canadian market, so classroom dates and Canadian trading dates may differ.

The teacher moves the common price date forward each session. Earlier saved valuations remain in the history. Students without a fresh valuation for that date, or whose holdings changed since their valuation, appear as awaiting a current valuation rather than receiving a misleading rank.

## Accounting and weekly work

Each student has an opening capital deposit, cash balance, permanent transaction ledger, cost-based holdings, daily market-value snapshots and weekly statements.

Purchase commissions are included in the investment book cost. Sale commissions reduce proceeds. Partial sales allocate book cost proportionately; a complete sale removes the remaining book cost. Daily unrealized gain/loss is the market value less the remaining investment book cost.

- **Assets = cash + investment market value**
- **Liabilities = $0** in this version, because borrowing is disabled
- **Equity = assets minus liabilities**
- **Equity = opening capital + realized gain/loss + unrealized gain/loss**

For the weekly statement, the student chooses the final saved valuation for that week and enters assets, liabilities and equity, plus a reflection. The totals must both balance and match that snapshot. The snapshot preserves the cash and holdings as of the save time; it is not a claim to reconstruct an exchange's official end-of-day accounting automatically.

Students can download an Excel workbook with Account Summary, Bank and Transactions, Current Holdings, Daily Research, and Weekly Statements. The teacher can download the class tally.

## Rankings and the end of the game

Rank by **total equity**, not shares plus equity (which would count investments twice). Tied equity receives a shared rank. Daily prices remain visibly student-entered until teacher review.

1. Set the final common Canadian price date.
2. Have every participating student save a fresh valuation after their last trade.
3. Open each student's portfolio. Check the price sources, quantities, journal and statements.
4. Mark the current valuation reviewed. Another trade or valuation clears this review status.
5. Once all participating students have current, reviewed valuations, finalize the game.

Finalization permanently closes trading and entries and freezes the reviewed results. Highest equity wins; ties produce joint winners.

## Validation and development preview

The backend tests use a disposable PostgreSQL database to verify school/class access, student privacy, the 60-player limit, atomic initial purchases, fees, overselling/overspending protection, duplicate submissions, research completeness, weekly reconciliation, shared price dates, teacher review and frozen final results. Frontend tests cover exact trade previews and exported workbook content.

`/qa/stock-game-preview.html` is a development-only sample interface. Its local fixture server uses fictional student accounts and prices and never connects to school records or a live quote service.
