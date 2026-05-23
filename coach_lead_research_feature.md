# Lead Research Automation Feature

## Overview
A dashboard feature that uses Claude API + web search to help coaches find and research potential clients in their area. Coach inputs search criteria, system surfaces contact info (Instagram handles, emails, websites), coach manually reaches out.

## Why This Works
- Research acceleration, not spam automation
- Coach does manual outreach (no bot activity)
- Legitimate alternative to cold scraping
- High-intent leads from targeted searches

## Feature Specs

### Input
Coach enters search criteria like:
- "Fitness influencers in Atlanta with 5K-50K followers"
- "Corporate wellness program managers in 30326 zip code"
- "Women's health coaches in metro Atlanta"

### Processing
- Claude API receives search query
- Uses web_search tool to find matching profiles/people
- Aggregates results with publicly available contact info:
  - Instagram handle
  - Email (if public)
  - Website/business URL
  - Facebook page
  - Phone (if listed)

### Output
Dashboard displays structured results:
- Profile name/handle
- Platform (Instagram, website, etc.)
- Contact methods available
- Quick links to profiles (coach clicks through, manually DMs)

## Pricing Tiers

**Starter Plan:** 5 searches/month
**Standard Plan:** 20 searches/month
**Premium Plan:** 50 searches/month

## API Cost Considerations
- Each search ~$0.01-0.05 in Claude API costs
- Capped searches = predictable monthly costs
- Example: 50 searches × $0.03 avg = $1.50/month per coach
- Margin built into tier pricing

## Implementation Notes
- Use Claude API web_search tool
- Parse results into consistent format
- Store search history (coach can re-run saved searches)
- Display results in clean card/table UI
- Add "open in new tab" links to profiles
