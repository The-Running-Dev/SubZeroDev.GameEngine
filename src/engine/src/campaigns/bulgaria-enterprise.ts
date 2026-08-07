import type { BuiltCampaign } from "../core/registry/types.js";
import type { CommandResult } from "../core/kernel/reasons.js";
import type { StoryGraphCampaignSource } from "../kinds/story-graph/source.js";
import { buildAdventureCampaign, createAdventureSource, migrateV1AdventureState, type AdventureConfig } from "./adventure-builder.js";
import type { PortableCatalog, PortableMigration } from "../spike/portable.js";

export const BULGARIA_ENTERPRISE_CAMPAIGN_ID = "bulgaria-enterprise";

// SPIKE: catalog card travels with the campaign instead of a positional entry in
// site/src/play/composition.ts. See plans/spike-notes.md.
export const bulgariaEnterpriseCatalog: PortableCatalog = {
  title: "Enterprise",
  description: "Clients, tax, hiring, growth, cashflow, and the price of one more opportunity.",
  duration: "10–15 min per route",
  contentNotice: "Debt, bankruptcy, audits, job pressure, and business failure.",
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
  description: "Registration, clients, tax, invoices, hiring, competition, government, growth, sale, and failure.",
  startNodeId: "starting_a_business",
  intro: "Your company is officially registered. Its first visitors are the Tax Agency, Labour Inspectorate, and Health Inspectorate. None of them are customers.",
  statLabels: { preparation: "Runway", connections: "Reputation", pressure: "Cashflow Pressure" },
  routes: [
    {
      id: "consultant_route", choiceId: "offer_coffee", label: "Stay small and win the first client", memoryLabel: "the client's trust",
      scenes: [
        "Your first client wants a proposal by Friday, a discount by Thursday, and confidence immediately.",
        "The invoice is accepted in seconds and scheduled for payment in sixty days.",
        "A tax letter asks for clarification about income that has not yet become money.",
        "The consultancy can remain deliberate, grow into an agency, or exhaust itself performing success.",
      ],
      actionLabels: ["Ask what success means before pricing", "Promise the full wishlist", "Keep the signed scope beside the invoice", "Assume goodwill will handle scope", "Call the accountant before replying", "Reply from memory tonight", "Ask the client for a reference", "Take the next project quietly"],
      eventLabels: ["The client removes half the wishlist and trusts the smaller promise more.", "A competitor underbids by excluding the work from the price.", "The tax letter is routine; the accountant identifies the correct checkbox in under an hour.", "A bad review appears for a company with the same name and a different comma."],
      endings: [
        { id: "consultant", title: "The Independent Consultant", text: "The calendar fills, the invoices clear, and the company stays small enough to recognize itself.", outcome: "win" },
        { id: "agency", title: "The Careful Agency", text: "The first client's trust becomes a referral, then a team, then a business that can survive your day off.", outcome: "win", gate: "memory" },
      ],
    },
    {
      id: "company_route", choiceId: "ask_who_invited_them", label: "Build a company before the inspectors return", memoryLabel: "the employee's loyalty",
      scenes: [
        "Hiring one person creates payroll, policy, equipment, and a government portal that prefers yesterday's browser.",
        "A competitor recruits your prospect while your team repairs the first client's server outage.",
        "A government opportunity arrives with a short deadline and a folder of declarations about other declarations.",
        "Growth is now real enough to choose: disciplined company, platform bet, or a profitable sale before scale becomes weather.",
      ],
      actionLabels: ["Explain the runway and hire carefully", "Hire three people for momentum", "Save the outage postmortem", "Blame the hosting provider publicly", "Split the tender into a checklist", "Submit the boldest possible bid", "Promote the teammate who held the outage", "Meet the interested buyer alone"],
      eventLabels: ["The careful hire brings a client relationship stronger than the job board promised.", "The third hire asks when payroll runs; nobody has yet asked payroll.", "Your outage postmortem wins the government evaluator's technical confidence.", "A server outage begins eleven minutes before submission and ends twelve minutes after."],
      endings: [
        { id: "successful_company", title: "The Durable Company", text: "Revenue, process, and people finally reinforce each other. Growth stops feeling like falling upward.", outcome: "win", gate: "memory" },
        { id: "platform_company", title: "The Platform Bet", text: "You turn repeated client work into a product. The roadmap becomes longer and the margins become possible.", outcome: "win", gate: "prepared" },
      ],
    },
    {
      id: "pressure_route", choiceId: "hide", label: "Hide from the inspectors and chase cash", memoryLabel: "the investor's warning",
      scenes: [
        "A late payment forces a choice between supplier trust, payroll, and pretending the bank balance is a design problem.",
        "An audit notice arrives on the same morning as a lucky client with an implausibly large opportunity.",
        "The lucky client requests exclusivity while an investor offers rescue on terms written in unusually friendly language.",
        "Cashflow has become a verdict. You may sell, close cleanly, or keep borrowing until optimism becomes an accounting category.",
      ],
      actionLabels: ["Tell the supplier exactly when payment lands", "Borrow silently and keep moving", "Keep the investor's warning email", "Spend the lucky deposit immediately", "Model the exclusivity cost", "Sign before the client cools", "Invite acquisition offers", "Take one final emergency loan"],
      eventLabels: ["The supplier grants two weeks because honesty turns out to have credit value.", "The bridge loan clears hours before payroll and starts charging interest immediately.", "The audit finds a filing error, not fraud, and the warning email proves when you corrected it.", "The lucky client pauses the project after the deposit has already funded three hires."],
      endings: [
        { id: "bankruptcy", title: "The Permanent Line Item", text: "Debt becomes the only reliable customer. You close the company and keep the lessons that cannot be invoiced.", outcome: "loss" },
        { id: "sale", title: "The Timely Sale", text: "The warning helps you recognize a fair offer before desperation sets the price. You sign and pay everyone.", outcome: "neutral", gate: "memory" },
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
