import type { User } from "../routes/users.js";

export interface TrustScoreBreakdown {
  deals_score: number;
  payment_score: number;
  endorsement_score: number;
  profile_score: number;
  response_score: number;
  penalties: number;
  raw_score: number;
  final_score: number;
}

function calcProfileCompleteness(u: User): number {
  const fields: unknown[] = [
    u.company_name,
    u.logo_url,
    u.owner_name,
    u.website,
    u.company_description,
    u.address,
    u.country,
    u.specialization,
    u.years_in_business,
  ];
  const filled = fields.filter((f) => f != null && f !== "").length;
  return Math.round((filled / fields.length) * 100);
}

export function calculateTrustScore(u: User): TrustScoreBreakdown {
  const totalPayments = (u.on_time_payments ?? 0) + (u.delayed_payments ?? 0);

  const deals_score = Math.min(100, (u.deals_completed ?? 0) * 5) * 0.30;

  const paymentRate = totalPayments > 0
    ? ((u.on_time_payments ?? 0) / totalPayments) * 100
    : 0;
  const payment_score = paymentRate * 0.30;

  const endorsement_score = Math.min(100, (u.endorsements_count ?? 0) * 10) * 0.20;

  const profile_score = calcProfileCompleteness(u) * 0.10;

  const response_score = (u.response_rate ?? 0) * 0.10;

  const dispute_penalty = (u.disputes_count ?? 0) * 20;
  const delay_penalty = (u.delayed_payments ?? 0) * 10;
  const penalties = dispute_penalty + delay_penalty;

  const raw_score = deals_score + payment_score + endorsement_score + profile_score + response_score;
  const final_score = Math.max(0, Math.min(100, Math.round(raw_score - penalties)));

  return {
    deals_score: Math.round(deals_score * 10) / 10,
    payment_score: Math.round(payment_score * 10) / 10,
    endorsement_score: Math.round(endorsement_score * 10) / 10,
    profile_score: Math.round(profile_score * 10) / 10,
    response_score: Math.round(response_score * 10) / 10,
    penalties,
    raw_score: Math.round(raw_score * 10) / 10,
    final_score,
  };
}

export function applyTrustScore(u: User): void {
  const { final_score } = calculateTrustScore(u);
  u.trust_score = final_score;
}
