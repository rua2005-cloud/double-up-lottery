// Original, virtual-credit-only setting-1 ST slot simulator.
// Derived from the validated Python v2.1 design. Not official internal odds.
export const BET = 3;
export const TARGET_BASE_PAYOUT = 3 - 50 / 31.8;
export const ROLE_PAY = Object.freeze({
  replay: 3, cherry: 1, watermelon: 3, weak: 1, strong: 1, middle: 1,
  common_bell: 15, one_coin: 1, ordinary_bell: 15, miss: 0,
});
const roleWeights = {
  replay: 1 / 7.3, cherry: 1 / 89.2, watermelon: 1 / 89.2,
  weak: 1 / 50.3, strong: 1 / 728.2, middle: 1 / 16384,
  common_bell: 1 / 95.8, one_coin: 0.12,
};
const fixedPayout = Object.entries(roleWeights).reduce((n, [k, p]) => n + ROLE_PAY[k] * p, 0);
roleWeights.ordinary_bell = (TARGET_BASE_PAYOUT - fixedPayout) / 15;
export const ROLE_WEIGHTS = Object.freeze(roleWeights);
const roleTable = Object.entries(ROLE_WEIGHTS).reduce((out, [role, p]) => {
  out.sum += p;
  out.values.push([role, out.sum]);
  return out;
}, { sum: 0, values: [] }).values;
const CONV_BASE = { replay: .34, cherry: .4, watermelon: .4, weak: .65, strong: 1, one_coin: .22 };
const CONV_HIT = { replay: .25, cherry: .4, watermelon: .4, weak: .3, strong: 1, one_coin: .35 };
const CZ_BOOST = { replay: .025, cherry: .18, watermelon: .18, weak: .12, strong: .7, middle: 1 };
const CZ_BOOST_MEAN = Object.entries(CZ_BOOST).reduce((sum, [role, b]) => sum + ROLE_WEIGHTS[role] * b, 0);
const AT_PHASES = ['first20', 'front50', 'st10', 'upper_front50', 'upper_st10'];
export const LABELS = Object.freeze({
  normal: '通常時', cz: 'チャンスゾーン', forced_cz: '天井CZ', prologue: 'ATプロローグ',
  first20: '初回ラッシュ20', front50: 'ラッシュ前半50', st10: 'ラッシュ後半ST10',
  upper_cz: '上位CZ', upper_front50: '上位ラッシュ前半', upper_st10: '上位ラッシュST',
  hold: '変換HOLD', bonus: 'ボーナス',
});
export const CONFIG = Object.freeze({
  normalCzBackground: .00015, direct: 1 / 22429.5,
  highCzShare: (1 / 3965) / (1 / 198.7),
  normalCzSuccess: .53, highCzSuccess: .83, upperCzSuccess: .7,
  czZones: { 100: .11, 250: .18, 400: .109, 600: .11, 750: .08 },
  stampZones: { 100: .098, 250: .204, 400: .098, 600: .047, 750: .047 },
  stampSuccess: .32, afterAtStamp: .112,
  highEnterWeak: .38, highDuration: 25, highMultiplier: 1.65,
  firstMultiplier: 1.17, frontMultiplier: 1.5, stMultiplier: 2.64,
  upperFrontMultiplier: 2.7, upperStMultiplier: 4.4, upperStFallback: .018,
  baseDouble: .499, baseEpisode: .04, baseBig: .01,
  upperEpisode: .18, upperBig: .04,
  giftUpgrade: .33, giftLuck: .035,
  pointScale: .78, upperPointScale: .54, aim: .08,
});

// Mulberry32: reproducible in-browser and Node, including save/load.
function nextRandom(state) {
  const s = (state + 0x6D2B79F5) >>> 0;
  let t = s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, s];
}
const count = (record, key, inc = 1) => { record[key] = (record[key] || 0) + inc; };

export class SlotGame {
  constructor(seed = 42) { this.reset(seed); }
  reset(seed = 42) {
    this.seed = seed >>> 0;
    this.rng = this.seed;
    this.phase = 'normal'; this.remaining = 0;
    this.bets = 0; this.payouts = 0; this.games = 0;
    this.spins = {}; this.events = {};
    this.normalSinceAt = 0; this.normalSinceCz = 0;
    this.atCeiling = 850; this.czCeiling = 600;
    this.stampActive = false; this.stamps = 0; this.highRemaining = 0;
    this.comebackRemaining = 0;
    this.points = 0; this.maxTicket = false;
    this.talents = { cherry: 0, watermelon: 0, weak: 0, replay: 0 };
    this.coreTalents = []; this.luck = false;
    this.czWon = false; this.czIsHigh = false; this.czInPullback = false;
    this.bonusData = null; this.holdData = null;
    this.lastRole = 'miss'; this.lastPay = 0; this.lastEvents = [];
    this.history = [{ game: 0, message: '設定1でスタート', kind: 'start' }];
    return this;
  }
  random() { const [value, next] = nextRandom(this.rng); this.rng = next; return value; }
  chance(p) { return this.random() < p; }
  randInt(lo, hi) { return lo + Math.floor(this.random() * (hi - lo + 1)); }
  role() { const x = this.random(); for (const [role, limit] of roleTable) if (x < limit) return role; return 'miss'; }
  emit(message, kind = 'info') {
    this.lastEvents.push({ game: this.games, kind, message });
    this.history.unshift({ game: this.games, message, kind });
    if (this.history.length > 32) this.history.length = 32;
  }
  spend(phase, role, grossPay = null) {
    this.games += 1; count(this.spins, phase);
    this.bets += BET;
    const pay = grossPay === null ? ROLE_PAY[role] : grossPay;
    this.payouts += pay; this.lastRole = role; this.lastPay = pay;
  }
  draw(phase, grossPay = null) {
    const role = this.role(); this.spend(phase, role, grossPay); return role;
  }
  phaseTo(phase, remaining = 0) { this.phase = phase; this.remaining = remaining; }
  setTalents(upper) {
    const core = upper ? ['cherry', 'watermelon'] : [this.chance(.5) ? 'cherry' : 'watermelon'];
    this.coreTalents = core;
    this.talents = { cherry: +core.includes('cherry') * 2, watermelon: +core.includes('watermelon') * 2, weak: 0, replay: 0 };
    this.luck = false; this.points = 0; this.maxTicket = false;
  }
  clearTempTalents() {
    for (const k of Object.keys(this.talents)) if (!this.coreTalents.includes(k)) this.talents[k] = 0;
  }
  grantGift() {
    if (this.chance(CONFIG.giftLuck)) this.luck = true;
    if (!this.chance(CONFIG.giftUpgrade)) return;
    const x = this.random();
    const role = x < .10 ? 'replay' : x < .50 ? 'weak' : x < .75 ? 'cherry' : 'watermelon';
    if (this.talents[role] >= 2) return;
    const p2 = role === 'replay' ? .08 : .16;
    this.talents[role] = this.chance(p2) ? 2 : Math.max(1, this.talents[role]);
    count(this.events, 'giftsUpgraded');
  }
  addPoints(amount, upper) {
    const old = this.points;
    const next = old + amount;
    if (old < 1000 && next >= 1000) {
      this.maxTicket = true;
      count(this.events, upper ? 'upperPointMax' : 'basePointMax');
      this.emit(upper ? '1000pt：上位ATの再セット確定' : '1000pt：上位CZの権利獲得', 'pointmax');
    }
    for (let n = Math.floor(old / 100); n < Math.min(9, Math.floor(next / 100)); n++) {
      count(this.events, 'gifts'); this.grantGift();
    }
    this.points = Math.min(next, 1000);
  }
  selectGross(upper) {
    const x = this.random(); let gross;
    if (upper) gross = x < CONFIG.upperBig ? 385 : x < CONFIG.upperBig + CONFIG.upperEpisode ? 300 : 200;
    else gross = x < CONFIG.baseBig ? 385 : x < CONFIG.baseBig + CONFIG.baseEpisode ? 300 : x < CONFIG.baseBig + CONFIG.baseEpisode + CONFIG.baseDouble ? 200 : 100;
    if (!upper && this.luck && gross === 100) gross = 200;
    this.luck = false;
    return gross;
  }
  startBonus(gross, upper, next, prologue = false) {
    const total = Math.ceil(gross / 11.4);
    this.bonusData = { gross, total, index: 0, next, upper, prologue };
    this.phaseTo('bonus', total);
    count(this.events, 'bonuses');
    count(this.events, prologue ? 'prologue' : upper ? 'upperBonuses' : 'baseBonuses');
    if (!prologue) this.clearTempTalents();
    this.emit(prologue ? 'プロローグ 100枚' : `${upper ? '上位' : ''}ボーナス ${gross}枚`, 'bonus');
  }
  stepBonus() {
    const b = this.bonusData;
    const role = this.role();
    const base = Math.floor(b.gross / b.total);
    const extra = b.gross % b.total;
    this.spend('bonus', role, base + +(b.index < extra));
    if (!b.prologue) {
      let pt = 5;
      if (role === 'replay') pt += 10;
      else if (role === 'weak') pt += 20;
      else if (role === 'cherry' || role === 'watermelon') pt += 45;
      else if (role === 'strong') pt += 115;
      else if (role === 'middle') pt += 295;
      if (this.chance(CONFIG.aim)) pt += 50;
      if (this.chance(.06)) pt += 20;
      this.addPoints(Math.round(pt * (b.upper ? CONFIG.upperPointScale : CONFIG.pointScale)), b.upper);
    }
    b.index++; this.remaining--;
    if (this.remaining === 0) {
      const next = b.next;
      this.bonusData = null;
      if (next === 'first20') this.phaseTo('first20', 20);
      else if (next === 'front50') this.phaseTo('front50', 50);
      else if (next === 'front_end') this.resolveFrontEnd(false);
      else if (next === 'upper_front_end') this.resolveFrontEnd(true);
      else if (next === 'front50_continue') this.phaseTo('front50', this.savedRemaining);
      else if (next === 'upper_front50_continue') this.phaseTo('upper_front50', this.savedRemaining);
      else if (next === 'st10_reset') this.resolveStBonus(false);
      else if (next === 'upper_st10_reset') this.resolveStBonus(true);
      else throw new Error(`Unknown bonus next: ${next}`);
    }
  }
  startAt(source, pullback = false) {
    count(this.events, 'atEntries'); count(this.events, `atCause_${source}`);
    this.normalSinceAt = 0; this.normalSinceCz = 0;
    this.highRemaining = 0; this.stampActive = false; this.stamps = 0;
    this.comebackRemaining = 0;
    if (pullback) {
      count(this.events, 'comebackSuccess'); this.emit('100G引き戻し成功：上位AT復帰', 'upper');
      this.startUpperAt();
    } else {
      count(this.events, 'baseAtEntries'); this.setTalents(false);
      this.emit('AT当選！ 初回20Gに挑戦', 'at');
      this.startBonus(100, false, 'first20', true);
    }
  }
  startUpperAt() {
    count(this.events, 'upperAtEntries');
    this.setTalents(true);
    this.phaseTo('upper_front50', 50);
    this.emit('上位ATに突入！ 両才能Lv2', 'upper');
  }
  finishBaseAt(firstFailed = false) {
    if (firstFailed) count(this.events, 'first20Failed');
    this.atCeiling = firstFailed ? 600 : 850;
    this.czCeiling = firstFailed ? 250 : 600;
    if (this.chance(CONFIG.afterAtStamp)) { this.stampActive = true; this.stamps = 0; count(this.events, 'afterAtStamp'); }
    this.phaseTo('normal');
    this.emit(firstFailed ? '20G駆け抜け：天井短縮' : '通常AT終了', 'end');
  }
  finishUpperAt() {
    count(this.events, 'upperStExits');
    this.comebackRemaining = 100;
    this.atCeiling = 850; this.czCeiling = 600;
    this.phaseTo('normal');
    this.emit('上位AT終了：100Gの引き戻し区間', 'end');
  }
  resolveFrontEnd(upper) {
    if (this.maxTicket) {
      if (upper) {
        count(this.events, 'upperRestarts');
        this.points = 0; this.maxTicket = false;
        this.phaseTo('upper_front50', 50);
        this.emit('1000pt達成：上位ATを50Gから再セット', 'upper');
      } else this.startUpperCz();
    } else this.phaseTo(upper ? 'upper_st10' : 'st10', 10);
  }
  resolveStBonus(upper) {
    if (this.maxTicket) this.resolveFrontEnd(upper);
    else this.phaseTo(upper ? 'upper_st10' : 'st10', 10);
  }
  startUpperCz() {
    count(this.events, 'upperCzEntries');
    this.czWon = false; this.phaseTo('upper_cz', 10);
    this.emit('上位CZ：突破期待度70%', 'cz');
  }
  czHitProbability(target, duration) {
    const baseline = 1 - Math.pow(1 - target, 1 / duration) / (1 - CZ_BOOST_MEAN);
    return baseline;
  }
  stepCz(upper = false, forced = false) {
    const phase = upper ? 'upper_cz' : forced ? 'forced_cz' : 'cz';
    const role = this.draw(phase);
    const target = upper ? CONFIG.upperCzSuccess : this.czIsHigh ? CONFIG.highCzSuccess : CONFIG.normalCzSuccess;
    const baseline = this.czHitProbability(target, upper ? 10 : 8);
    const p = baseline + (1 - baseline) * (CZ_BOOST[role] || 0);
    if (forced || this.chance(p)) this.czWon = true;
    this.remaining--;
    if (this.remaining > 0) return;
    if (upper) {
      if (this.czWon) { count(this.events, 'upperCzWins'); this.startUpperAt(); }
      else { count(this.events, 'upperCzFails'); this.atCeiling = 250; this.czCeiling = 250; this.phaseTo('normal'); this.emit('上位CZ失敗：天井250G', 'end'); }
    } else if (this.czWon) {
      if (!forced) count(this.events, 'czWins');
      this.startAt(forced ? 'ceiling' : 'cz', this.czInPullback);
    } else {
      count(this.events, 'czLosses'); this.phaseTo('normal'); this.emit('CZ失敗', 'end');
    }
  }
  startCz(pullback, forced = false) {
    count(this.events, 'czEntries'); this.normalSinceCz = 0;
    this.czInPullback = pullback; this.czWon = false;
    this.czIsHigh = !forced && this.chance(CONFIG.highCzShare);
    if (this.czIsHigh) count(this.events, 'highCzEntries');
    this.phaseTo(forced ? 'forced_cz' : 'cz', 8);
    this.emit(forced ? 'AT間天井到達：成功確定CZ' : this.czIsHigh ? '高期待度CZ突入' : 'CZ突入', 'cz');
  }
  stepNormal() {
    const role = this.draw('normal');
    this.normalSinceAt++; this.normalSinceCz++;
    if (this.highRemaining > 0) this.highRemaining--;
    const pullback = this.comebackRemaining > 0;
    if (pullback) this.comebackRemaining--; // 100th G remains eligible.
    if (role === 'weak' && this.chance(CONFIG.highEnterWeak)) this.highRemaining = CONFIG.highDuration;
    if (role === 'middle' || this.chance(CONFIG.direct)) { this.startAt('direct', pullback); return; }
    if (this.normalSinceAt >= this.atCeiling) { this.startCz(pullback, true); return; }
    let trigger = false;
    const zone = CONFIG.czZones[this.normalSinceAt];
    if (zone !== undefined) {
      if (this.chance(zone)) trigger = true;
      else if (this.chance(CONFIG.stampZones[this.normalSinceAt])) {
        this.stampActive = true; this.stamps = 0; count(this.events, 'stampCards');
      }
    }
    if (role === 'replay' && this.stampActive) {
      this.stamps++;
      if (this.stamps >= 12) {
        this.stampActive = false; this.stamps = 0;
        count(this.events, 'stampsCompleted');
        if (this.chance(CONFIG.stampSuccess)) trigger = true;
      }
    }
    if (this.normalSinceCz >= this.czCeiling) trigger = true;
    if (!trigger && ['cherry', 'watermelon', 'weak', 'strong'].includes(role)) {
      let chance = role === 'strong' ? 1 : .10;
      if (this.highRemaining) chance = Math.min(1, chance * CONFIG.highMultiplier);
      if (this.chance(chance) && this.chance(role === 'strong' ? .66 : .33)) trigger = true;
    }
    if (!trigger && this.chance(CONFIG.normalCzBackground)) trigger = true;
    if (trigger) this.startCz(pullback);
  }
  // A return value describes (hit, converted). Converted spins gain HOLD and preserve the parent timer.
  trigger(role, multiplier) {
    if (['common_bell', 'ordinary_bell', 'miss', 'middle'].includes(role)) return [role === 'middle', false];
    const lv = this.talents[role] || 0;
    if (lv >= 2) return [true, false];
    const converted = lv === 1 || this.chance(Math.min(1, (CONV_BASE[role] || 0) * multiplier));
    if (!converted) return [false, false];
    return [this.chance(CONV_HIT[role]), true];
  }
  stepAt() {
    const phase = this.phase;
    const multiplier = {
      first20: CONFIG.firstMultiplier, front50: CONFIG.frontMultiplier,
      st10: CONFIG.stMultiplier, upper_front50: CONFIG.upperFrontMultiplier,
      upper_st10: CONFIG.upperStMultiplier,
    }[phase];
    const role = this.draw(phase);
    const [triggerWon, converted] = this.trigger(role, multiplier);
    let won = triggerWon;
    this.remaining--;
    if (phase === 'upper_st10' && !won && this.chance(CONFIG.upperStFallback)) won = true;
    if (converted) {
      this.holdData = { parent: phase, won, remaining: this.remaining };
      this.phaseTo('hold', this.randInt(2, 4));
      count(this.events, 'holds');
      return;
    }
    this.afterAtSpin(phase, won);
  }
  stepHold() {
    const role = this.draw('hold');
    if (!this.holdData.won && ['replay', 'weak', 'cherry', 'watermelon', 'strong', 'middle'].includes(role) && this.chance(.04)) {
      this.holdData.won = true; count(this.events, 'holdRewrites');
    }
    this.remaining--;
    if (this.remaining === 0) {
      const { parent, won, remaining } = this.holdData;
      this.holdData = null; this.phaseTo(parent, remaining);
      this.afterAtSpin(parent, won);
    }
  }
  afterAtSpin(phase, won) {
    if (won) {
      count(this.events, `hits_${phase}`);
      if (phase === 'first20') count(this.events, 'first20Success');
      const upper = phase.startsWith('upper_');
      const gross = this.selectGross(upper);
      const next = phase === 'first20' ? 'front50' : phase === 'front50' ? (this.remaining ? 'front50_continue' : 'front_end')
        : phase === 'upper_front50' ? (this.remaining ? 'upper_front50_continue' : 'upper_front_end')
        : phase === 'st10' ? 'st10_reset' : 'upper_st10_reset';
      this.savedRemaining = this.remaining;
      this.startBonus(gross, upper, next);
      return;
    }
    if (this.remaining > 0) return;
    if (phase === 'first20') this.finishBaseAt(true);
    else if (phase === 'front50') this.resolveFrontEnd(false);
    else if (phase === 'upper_front50') this.resolveFrontEnd(true);
    else if (phase === 'st10') this.finishBaseAt(false);
    else if (phase === 'upper_st10') this.finishUpperAt();
  }
  step() {
    this.lastEvents = [];
    switch (this.phase) {
      case 'normal': this.stepNormal(); break;
      case 'cz': this.stepCz(); break;
      case 'forced_cz': this.stepCz(false, true); break;
      case 'upper_cz': this.stepCz(true); break;
      case 'bonus': this.stepBonus(); break;
      case 'hold': this.stepHold(); break;
      default:
        if (AT_PHASES.includes(this.phase)) this.stepAt();
        else throw new Error(`Unexpected state: ${this.phase}`);
    }
    return this.lastEvents;
  }
  get machineRate() { return this.bets ? this.payouts / this.bets * 100 : 0; }
  get diff() { return this.payouts - this.bets; }
  get summary() { return {
    games: this.games, bets: this.bets, payouts: this.payouts, diff: this.diff,
    machineRate: this.machineRate, normalGames: this.spins.normal || 0,
    czEntries: this.events.czEntries || 0,
    atEntries: this.events.atEntries || 0,
    baseAtEntries: this.events.baseAtEntries || 0,
    upperAtEntries: this.events.upperAtEntries || 0,
    bonuses: this.events.bonuses || 0,
    atRate: (this.events.atEntries || 0) ? (this.spins.normal || 0) / this.events.atEntries : null,
    czRate: (this.events.czEntries || 0) ? (this.spins.normal || 0) / this.events.czEntries : null,
  }; }
  serialize() { return JSON.stringify({ version: 2, data: { ...this, lastEvents: [] } }); }
  static restore(raw) {
    const parsed = JSON.parse(raw);
    if (parsed.version !== 2 || !parsed.data || !Number.isFinite(parsed.data.games)) throw new Error('Incompatible save');
    const game = new SlotGame(1);
    Object.assign(game, parsed.data);
    return game;
  }
}