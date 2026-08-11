import type { BuiltCampaign } from "../core/registry/types.js";
import type { CommandResult } from "../core/kernel/reasons.js";
import type { StoryGraphCampaignSource } from "../kinds/story-graph/source.js";
import { buildAdventureCampaign, createAdventureSource, migrateV1AdventureState, type AdventureConfig } from "./adventure-builder.js";
import type { PortableCatalog, PortableMigration } from "../portable/format.js";

export const BULGARIA_ENTERPRISE_CAMPAIGN_ID = "bulgaria-enterprise";

// The catalog card travels with the campaign, not a positional entry in
// site/src/play/composition.ts.
export const bulgariaEnterpriseCatalog: PortableCatalog = {
  title: "Enterprise",
  description: "Clients, tax, hiring, growth, cashflow, and the price of one more opportunity — now with considerably more ways for the company to end (most of them survivable).",
  duration: "10–15 min per route",
  contentNotice: "Debt, bankruptcy, audits, job pressure, business failure, and mild tax-avoidance humor.",
  featured: false,
};

export const bulgariaEnterpriseMigration: PortableMigration = {
  fromVersion: "1.0.0",
  nodeMap: {
    entrepreneur: "consultant_route_2",
    ending: "ending_consultant",
  },
  endingMap: { a_permanent_line_item: "bankruptcy" },
};

const config: AdventureConfig = {
  id: BULGARIA_ENTERPRISE_CAMPAIGN_ID,
  namespace: "enterprise",
  title: "Enterprise",
  description: "Registration, clients, tax, invoices, hiring, competition, government tenders, growth, sale, and failure — Bulgarian small business, dramatized.",
  startNodeId: "starting_a_business",
  intro: "Your company is officially registered — a fresh ЕИК, a bank account, and a company stamp you were mildly disappointed to learn is now optional. Its first visitors are the Tax Agency, the Labour Inspectorate, and the Health Inspectorate. None of them are customers.",
  statLabels: { preparation: "Runway", connections: "Reputation", pressure: "Cashflow Pressure" },
  routes: [
    {
      id: "consultant_route", choiceId: "offer_coffee", label: "Stay small and win the first client", memoryLabel: "the client's trust",
      scenes: [
        "Your first client wants a proposal by Friday, a discount by Thursday, and your total confidence immediately, ideally before either.",
        "The invoice is accepted in seconds and quietly scheduled for payment in exactly sixty days, per 'standard company policy.'",
        "A tax letter politely asks for clarification about income that has not, strictly speaking, become money yet.",
        "The consultancy can now stay deliberately small, grow into an agency, or exhaust itself performing a success it hasn't quite reached.",
      ],
      actionLabels: ["Ask what success means before pricing", "Promise the full wishlist", "Keep the signed scope beside the invoice", "Assume goodwill will handle scope", "Call the accountant before replying", "Reply from memory tonight", "Ask the client for a reference", "Take the next project quietly"],
      eventLabels: ["The client removes half the wishlist unprompted and trusts the smaller, honest promise considerably more.", "A competitor underbids you by quietly excluding the actual work from the price.", "The tax letter turns out to be routine; the accountant finds the correct checkbox in under an hour, visibly bored by the whole thing.", "A bad review appears — for a company with the same name and, mercifully, one different comma."],
      endings: [
        { id: "consultant", title: "The Independent Consultant", text: "The calendar fills, the invoices clear, and the company stays exactly small enough to still recognize itself.", outcome: "win" },
        { id: "agency", title: "The Careful Agency", text: "The first client's trust becomes a referral, then a team, then a business that can survive your actual day off.", outcome: "win", gate: "memory" },
        { id: "accountant_becomes_indispensable", title: "The Real Founder Was the Accountant", text: "You quietly realize the company has survived three near-disasters entirely because of one extremely competent accountant. You give her a raise before you give yourself one.", outcome: "win" },
        { id: "client_disappears_owing_two_invoices", title: "Ghosted, Professionally", text: "Your best client stops answering after invoice two. The company registration lookup shows the business still exists, still trading, apparently just not with you anymore.", outcome: "loss" },
        { id: "becomes_an_influencer_by_accident", title: "Personal Brand, Unplanned", text: "A rant you posted about invoice culture goes mildly viral in local business circles. You now have more followers than clients, and an uncomfortable number of DMs asking for 'just a quick favour.'", outcome: "neutral", gate: "prepared" },
      ],
    },
    {
      id: "company_route", choiceId: "ask_who_invited_them", label: "Build a company before the inspectors return", memoryLabel: "the employee's loyalty",
      scenes: [
        "Hiring one single person creates payroll, policy, equipment, and a government portal that clearly prefers yesterday's browser and possibly yesterday's government.",
        "A competitor recruits your best prospect directly while your team is busy repairing the first client's server outage.",
        "A government tender arrives with a short deadline and a folder of declarations, each one requiring a separate declaration confirming the first.",
        "Growth is now real enough to require a choice: a disciplined company, a platform bet, or a well-timed sale before scale turns into weather.",
      ],
      actionLabels: ["Explain the runway and hire carefully", "Hire three people for momentum", "Save the outage postmortem", "Blame the hosting provider publicly", "Split the tender into a checklist", "Submit the boldest possible bid", "Promote the teammate who held the outage", "Meet the interested buyer alone"],
      eventLabels: ["The careful hire arrives with a client relationship stronger than the job listing ever promised.", "The third hire asks, reasonably, when payroll runs. Nobody has yet actually asked payroll.", "Your outage postmortem, oddly, wins the government evaluator's full technical confidence.", "A server outage begins eleven minutes before submission and ends twelve minutes after — a margin everyone agrees not to discuss again."],
      endings: [
        { id: "successful_company", title: "The Durable Company", text: "Revenue, process, and people finally reinforce each other. Growth stops feeling like falling upward.", outcome: "win", gate: "memory" },
        { id: "platform_company", title: "The Platform Bet", text: "You turn repeated client work into an actual product. The roadmap gets longer and, for the first time, so do the margins.", outcome: "win", gate: "prepared" },
        { id: "best_employee_leaves_for_germany", title: "Gone to Munich, With Love", text: "Your best engineer gives two months' notice, a firm handshake, and a job offer in Munich paying triple. You can't even be angry — you'd have taken it too.", outcome: "neutral" },
        { id: "tender_won_paperwork_lost", title: "You Won. The Folder Didn't.", text: "You win the tender outright. A single missing declaration, page fourteen of nineteen, disqualifies the submission on a technicality discovered three weeks later, well past appeal.", outcome: "loss" },
        { id: "quietly_becomes_the_towns_biggest_employer", title: "Nobody Noticed It Happening", text: "Between the careful hires and the steady contracts, the company becomes, without any single dramatic moment, the largest employer in the neighbourhood. The mayor asks you to open the Christmas market.", outcome: "win" },
      ],
    },
    {
      id: "pressure_route", choiceId: "hide", label: "Hide from the inspectors and chase cash", memoryLabel: "the investor's warning",
      scenes: [
        "A late payment forces a choice between supplier trust, payroll, and quietly treating the bank balance as a design problem.",
        "An audit notice arrives the same morning as a lucky client offering an implausibly large opportunity.",
        "The lucky client requests exclusivity while an investor offers rescue on terms written in suspiciously friendly language.",
        "Cashflow has become a verdict. You may sell, close cleanly, or keep borrowing until optimism officially becomes an accounting category.",
      ],
      actionLabels: ["Tell the supplier exactly when payment lands", "Borrow silently and keep moving", "Keep the investor's warning email", "Spend the lucky deposit immediately", "Model the exclusivity cost", "Sign before the client cools", "Invite acquisition offers", "Take one final emergency loan"],
      eventLabels: ["The supplier grants two full weeks, because honesty turns out to have real, tradeable credit value.", "The bridge loan clears hours before payroll and starts charging interest literally immediately.", "The audit finds a filing error, not fraud — and the warning email proves exactly when you corrected it.", "The lucky client pauses the project right after the deposit has already funded three new hires."],
      endings: [
        { id: "bankruptcy", title: "The Permanent Line Item", text: "Debt becomes the only reliable customer left. You close the company and keep only the lessons that couldn't be invoiced.", outcome: "loss" },
        { id: "sale", title: "The Timely Sale", text: "The warning helps you recognize a fair offer before desperation sets the price. You sign, and for once, pay everyone.", outcome: "neutral", gate: "memory" },
        { id: "investor_takes_over_completely", title: "Rescued, Then Replaced", text: "The investor's terms are friendly right up until the board meeting where you learn 'strategic realignment' means you personally. The company survives. You, professionally, do not.", outcome: "loss" },
        { id: "audit_clears_you_publicly", title: "Vindicated, On the Record", text: "The audit not only clears you but becomes, oddly, a credibility boost — 'audited and clean' turns out to be a better sales line than any marketing you ever paid for.", outcome: "win", gate: "prepared" },
        { id: "one_more_loan_actually_works", title: "The Loan That Shouldn't Have Worked", text: "Against every reasonable prediction, one final loan buys exactly enough time for the lucky client's payment to land first. Nobody, including you, recommends this as a strategy.", outcome: "win" },
      ],
    },
  ],
  startAliases: [{ id: "pretend_business_never_opened", label: "Avoid the inspectors and focus on cash", routeId: "pressure_route" }],
};

export const bulgariaEnterpriseSource = createAdventureSource(config);

export function buildBulgariaEnterpriseCampaign(source: StoryGraphCampaignSource = bulgariaEnterpriseSource): CommandResult<BuiltCampaign> {
  const result = buildAdventureCampaign(config, source);
  if (result.ok && result.value) {
    result.value.campaign.migrateState = (state, fromVersion) => migrateV1AdventureState(state, fromVersion, source, {
      entrepreneur: "consultant_route_2",
      ending: "ending_consultant",
    }, { a_permanent_line_item: "bankruptcy" });
  }
  return result;
}
