const GOAL_PATTERN = /cel|goal|problem|zadani|opis/i;
const ACCEPTANCE_PATTERN = /kryteri|acceptance|oczekiw|powin|must|verify|sprawd/i;
const VISUAL_PATTERN =
  /three|3d|scen|model|animac|ruch|camera|kamera|shader|świat|swiat|hud|ui|interakc|webgl|render|materiał|tekstur|audio|multiplayer|socket/i;

/** Ocenia, czy Issue ma dość informacji, by agent nie wymyślał zasad gry. */
export function assessIssueQuality(issue) {
  const body = issue.body?.trim() ?? '';
  const missing = [];
  if (body.length < 80 || !GOAL_PATTERN.test(`${issue.title}\n${body}`)) missing.push('goal/context');
  if (!ACCEPTANCE_PATTERN.test(body)) missing.push('acceptance criteria or expected behavior');
  return {
    status: missing.length ? 'NEEDS_HUMAN_CLARIFICATION' : 'PASS',
    missing,
    browserVerificationRequired: VISUAL_PATTERN.test(`${issue.title}\n${body}`),
  };
}
