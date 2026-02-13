/**
 * @license
 * Copyright 2019 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const V = globalThis, X = V.ShadowRoot && (V.ShadyCSS === void 0 || V.ShadyCSS.nativeShadow) && "adoptedStyleSheets" in Document.prototype && "replace" in CSSStyleSheet.prototype, J = Symbol(), Q = /* @__PURE__ */ new WeakMap();
let ht = class {
  constructor(t, e, s) {
    if (this._$cssResult$ = !0, s !== J) throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");
    this.cssText = t, this.t = e;
  }
  get styleSheet() {
    let t = this.o;
    const e = this.t;
    if (X && t === void 0) {
      const s = e !== void 0 && e.length === 1;
      s && (t = Q.get(e)), t === void 0 && ((this.o = t = new CSSStyleSheet()).replaceSync(this.cssText), s && Q.set(e, t));
    }
    return t;
  }
  toString() {
    return this.cssText;
  }
};
const vt = (i) => new ht(typeof i == "string" ? i : i + "", void 0, J), bt = (i, ...t) => {
  const e = i.length === 1 ? i[0] : t.reduce((s, o, r) => s + ((n) => {
    if (n._$cssResult$ === !0) return n.cssText;
    if (typeof n == "number") return n;
    throw Error("Value passed to 'css' function must be a 'css' function result: " + n + ". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.");
  })(o) + i[r + 1], i[0]);
  return new ht(e, i, J);
}, yt = (i, t) => {
  if (X) i.adoptedStyleSheets = t.map((e) => e instanceof CSSStyleSheet ? e : e.styleSheet);
  else for (const e of t) {
    const s = document.createElement("style"), o = V.litNonce;
    o !== void 0 && s.setAttribute("nonce", o), s.textContent = e.cssText, i.appendChild(s);
  }
}, tt = X ? (i) => i : (i) => i instanceof CSSStyleSheet ? ((t) => {
  let e = "";
  for (const s of t.cssRules) e += s.cssText;
  return vt(e);
})(i) : i;
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const { is: gt, defineProperty: xt, getOwnPropertyDescriptor: $t, getOwnPropertyNames: wt, getOwnPropertySymbols: _t, getPrototypeOf: At } = Object, $ = globalThis, et = $.trustedTypes, St = et ? et.emptyScript : "", W = $.reactiveElementPolyfillSupport, D = (i, t) => i, j = { toAttribute(i, t) {
  switch (t) {
    case Boolean:
      i = i ? St : null;
      break;
    case Object:
    case Array:
      i = i == null ? i : JSON.stringify(i);
  }
  return i;
}, fromAttribute(i, t) {
  let e = i;
  switch (t) {
    case Boolean:
      e = i !== null;
      break;
    case Number:
      e = i === null ? null : Number(i);
      break;
    case Object:
    case Array:
      try {
        e = JSON.parse(i);
      } catch {
        e = null;
      }
  }
  return e;
} }, Z = (i, t) => !gt(i, t), st = { attribute: !0, type: String, converter: j, reflect: !1, useDefault: !1, hasChanged: Z };
Symbol.metadata ?? (Symbol.metadata = Symbol("metadata")), $.litPropertyMetadata ?? ($.litPropertyMetadata = /* @__PURE__ */ new WeakMap());
let k = class extends HTMLElement {
  static addInitializer(t) {
    this._$Ei(), (this.l ?? (this.l = [])).push(t);
  }
  static get observedAttributes() {
    return this.finalize(), this._$Eh && [...this._$Eh.keys()];
  }
  static createProperty(t, e = st) {
    if (e.state && (e.attribute = !1), this._$Ei(), this.prototype.hasOwnProperty(t) && ((e = Object.create(e)).wrapped = !0), this.elementProperties.set(t, e), !e.noAccessor) {
      const s = Symbol(), o = this.getPropertyDescriptor(t, s, e);
      o !== void 0 && xt(this.prototype, t, o);
    }
  }
  static getPropertyDescriptor(t, e, s) {
    const { get: o, set: r } = $t(this.prototype, t) ?? { get() {
      return this[e];
    }, set(n) {
      this[e] = n;
    } };
    return { get: o, set(n) {
      const a = o == null ? void 0 : o.call(this);
      r == null || r.call(this, n), this.requestUpdate(t, a, s);
    }, configurable: !0, enumerable: !0 };
  }
  static getPropertyOptions(t) {
    return this.elementProperties.get(t) ?? st;
  }
  static _$Ei() {
    if (this.hasOwnProperty(D("elementProperties"))) return;
    const t = At(this);
    t.finalize(), t.l !== void 0 && (this.l = [...t.l]), this.elementProperties = new Map(t.elementProperties);
  }
  static finalize() {
    if (this.hasOwnProperty(D("finalized"))) return;
    if (this.finalized = !0, this._$Ei(), this.hasOwnProperty(D("properties"))) {
      const e = this.properties, s = [...wt(e), ..._t(e)];
      for (const o of s) this.createProperty(o, e[o]);
    }
    const t = this[Symbol.metadata];
    if (t !== null) {
      const e = litPropertyMetadata.get(t);
      if (e !== void 0) for (const [s, o] of e) this.elementProperties.set(s, o);
    }
    this._$Eh = /* @__PURE__ */ new Map();
    for (const [e, s] of this.elementProperties) {
      const o = this._$Eu(e, s);
      o !== void 0 && this._$Eh.set(o, e);
    }
    this.elementStyles = this.finalizeStyles(this.styles);
  }
  static finalizeStyles(t) {
    const e = [];
    if (Array.isArray(t)) {
      const s = new Set(t.flat(1 / 0).reverse());
      for (const o of s) e.unshift(tt(o));
    } else t !== void 0 && e.push(tt(t));
    return e;
  }
  static _$Eu(t, e) {
    const s = e.attribute;
    return s === !1 ? void 0 : typeof s == "string" ? s : typeof t == "string" ? t.toLowerCase() : void 0;
  }
  constructor() {
    super(), this._$Ep = void 0, this.isUpdatePending = !1, this.hasUpdated = !1, this._$Em = null, this._$Ev();
  }
  _$Ev() {
    var t;
    this._$ES = new Promise((e) => this.enableUpdating = e), this._$AL = /* @__PURE__ */ new Map(), this._$E_(), this.requestUpdate(), (t = this.constructor.l) == null || t.forEach((e) => e(this));
  }
  addController(t) {
    var e;
    (this._$EO ?? (this._$EO = /* @__PURE__ */ new Set())).add(t), this.renderRoot !== void 0 && this.isConnected && ((e = t.hostConnected) == null || e.call(t));
  }
  removeController(t) {
    var e;
    (e = this._$EO) == null || e.delete(t);
  }
  _$E_() {
    const t = /* @__PURE__ */ new Map(), e = this.constructor.elementProperties;
    for (const s of e.keys()) this.hasOwnProperty(s) && (t.set(s, this[s]), delete this[s]);
    t.size > 0 && (this._$Ep = t);
  }
  createRenderRoot() {
    const t = this.shadowRoot ?? this.attachShadow(this.constructor.shadowRootOptions);
    return yt(t, this.constructor.elementStyles), t;
  }
  connectedCallback() {
    var t;
    this.renderRoot ?? (this.renderRoot = this.createRenderRoot()), this.enableUpdating(!0), (t = this._$EO) == null || t.forEach((e) => {
      var s;
      return (s = e.hostConnected) == null ? void 0 : s.call(e);
    });
  }
  enableUpdating(t) {
  }
  disconnectedCallback() {
    var t;
    (t = this._$EO) == null || t.forEach((e) => {
      var s;
      return (s = e.hostDisconnected) == null ? void 0 : s.call(e);
    });
  }
  attributeChangedCallback(t, e, s) {
    this._$AK(t, s);
  }
  _$ET(t, e) {
    var r;
    const s = this.constructor.elementProperties.get(t), o = this.constructor._$Eu(t, s);
    if (o !== void 0 && s.reflect === !0) {
      const n = (((r = s.converter) == null ? void 0 : r.toAttribute) !== void 0 ? s.converter : j).toAttribute(e, s.type);
      this._$Em = t, n == null ? this.removeAttribute(o) : this.setAttribute(o, n), this._$Em = null;
    }
  }
  _$AK(t, e) {
    var r, n;
    const s = this.constructor, o = s._$Eh.get(t);
    if (o !== void 0 && this._$Em !== o) {
      const a = s.getPropertyOptions(o), l = typeof a.converter == "function" ? { fromAttribute: a.converter } : ((r = a.converter) == null ? void 0 : r.fromAttribute) !== void 0 ? a.converter : j;
      this._$Em = o;
      const c = l.fromAttribute(e, a.type);
      this[o] = c ?? ((n = this._$Ej) == null ? void 0 : n.get(o)) ?? c, this._$Em = null;
    }
  }
  requestUpdate(t, e, s, o = !1, r) {
    var n;
    if (t !== void 0) {
      const a = this.constructor;
      if (o === !1 && (r = this[t]), s ?? (s = a.getPropertyOptions(t)), !((s.hasChanged ?? Z)(r, e) || s.useDefault && s.reflect && r === ((n = this._$Ej) == null ? void 0 : n.get(t)) && !this.hasAttribute(a._$Eu(t, s)))) return;
      this.C(t, e, s);
    }
    this.isUpdatePending === !1 && (this._$ES = this._$EP());
  }
  C(t, e, { useDefault: s, reflect: o, wrapped: r }, n) {
    s && !(this._$Ej ?? (this._$Ej = /* @__PURE__ */ new Map())).has(t) && (this._$Ej.set(t, n ?? e ?? this[t]), r !== !0 || n !== void 0) || (this._$AL.has(t) || (this.hasUpdated || s || (e = void 0), this._$AL.set(t, e)), o === !0 && this._$Em !== t && (this._$Eq ?? (this._$Eq = /* @__PURE__ */ new Set())).add(t));
  }
  async _$EP() {
    this.isUpdatePending = !0;
    try {
      await this._$ES;
    } catch (e) {
      Promise.reject(e);
    }
    const t = this.scheduleUpdate();
    return t != null && await t, !this.isUpdatePending;
  }
  scheduleUpdate() {
    return this.performUpdate();
  }
  performUpdate() {
    var s;
    if (!this.isUpdatePending) return;
    if (!this.hasUpdated) {
      if (this.renderRoot ?? (this.renderRoot = this.createRenderRoot()), this._$Ep) {
        for (const [r, n] of this._$Ep) this[r] = n;
        this._$Ep = void 0;
      }
      const o = this.constructor.elementProperties;
      if (o.size > 0) for (const [r, n] of o) {
        const { wrapped: a } = n, l = this[r];
        a !== !0 || this._$AL.has(r) || l === void 0 || this.C(r, void 0, n, l);
      }
    }
    let t = !1;
    const e = this._$AL;
    try {
      t = this.shouldUpdate(e), t ? (this.willUpdate(e), (s = this._$EO) == null || s.forEach((o) => {
        var r;
        return (r = o.hostUpdate) == null ? void 0 : r.call(o);
      }), this.update(e)) : this._$EM();
    } catch (o) {
      throw t = !1, this._$EM(), o;
    }
    t && this._$AE(e);
  }
  willUpdate(t) {
  }
  _$AE(t) {
    var e;
    (e = this._$EO) == null || e.forEach((s) => {
      var o;
      return (o = s.hostUpdated) == null ? void 0 : o.call(s);
    }), this.hasUpdated || (this.hasUpdated = !0, this.firstUpdated(t)), this.updated(t);
  }
  _$EM() {
    this._$AL = /* @__PURE__ */ new Map(), this.isUpdatePending = !1;
  }
  get updateComplete() {
    return this.getUpdateComplete();
  }
  getUpdateComplete() {
    return this._$ES;
  }
  shouldUpdate(t) {
    return !0;
  }
  update(t) {
    this._$Eq && (this._$Eq = this._$Eq.forEach((e) => this._$ET(e, this[e]))), this._$EM();
  }
  updated(t) {
  }
  firstUpdated(t) {
  }
};
k.elementStyles = [], k.shadowRootOptions = { mode: "open" }, k[D("elementProperties")] = /* @__PURE__ */ new Map(), k[D("finalized")] = /* @__PURE__ */ new Map(), W == null || W({ ReactiveElement: k }), ($.reactiveElementVersions ?? ($.reactiveElementVersions = [])).push("2.1.2");
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const N = globalThis, it = (i) => i, L = N.trustedTypes, ot = L ? L.createPolicy("lit-html", { createHTML: (i) => i }) : void 0, pt = "$lit$", x = `lit$${Math.random().toFixed(9).slice(2)}$`, ut = "?" + x, Et = `<${ut}>`, E = document, O = () => E.createComment(""), U = (i) => i === null || typeof i != "object" && typeof i != "function", G = Array.isArray, kt = (i) => G(i) || typeof (i == null ? void 0 : i[Symbol.iterator]) == "function", q = `[ 	
\f\r]`, H = /<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g, nt = /-->/g, rt = />/g, _ = RegExp(`>|${q}(?:([^\\s"'>=/]+)(${q}*=${q}*(?:[^ 	
\f\r"'\`<>=]|("|')|))|$)`, "g"), at = /'/g, lt = /"/g, mt = /^(?:script|style|textarea|title)$/i, Mt = (i) => (t, ...e) => ({ _$litType$: i, strings: t, values: e }), p = Mt(1), M = Symbol.for("lit-noChange"), u = Symbol.for("lit-nothing"), ct = /* @__PURE__ */ new WeakMap(), A = E.createTreeWalker(E, 129);
function ft(i, t) {
  if (!G(i) || !i.hasOwnProperty("raw")) throw Error("invalid template strings array");
  return ot !== void 0 ? ot.createHTML(t) : t;
}
const Pt = (i, t) => {
  const e = i.length - 1, s = [];
  let o, r = t === 2 ? "<svg>" : t === 3 ? "<math>" : "", n = H;
  for (let a = 0; a < e; a++) {
    const l = i[a];
    let c, h, d = -1, v = 0;
    for (; v < l.length && (n.lastIndex = v, h = n.exec(l), h !== null); ) v = n.lastIndex, n === H ? h[1] === "!--" ? n = nt : h[1] !== void 0 ? n = rt : h[2] !== void 0 ? (mt.test(h[2]) && (o = RegExp("</" + h[2], "g")), n = _) : h[3] !== void 0 && (n = _) : n === _ ? h[0] === ">" ? (n = o ?? H, d = -1) : h[1] === void 0 ? d = -2 : (d = n.lastIndex - h[2].length, c = h[1], n = h[3] === void 0 ? _ : h[3] === '"' ? lt : at) : n === lt || n === at ? n = _ : n === nt || n === rt ? n = H : (n = _, o = void 0);
    const g = n === _ && i[a + 1].startsWith("/>") ? " " : "";
    r += n === H ? l + Et : d >= 0 ? (s.push(c), l.slice(0, d) + pt + l.slice(d) + x + g) : l + x + (d === -2 ? a : g);
  }
  return [ft(i, r + (i[e] || "<?>") + (t === 2 ? "</svg>" : t === 3 ? "</math>" : "")), s];
};
class R {
  constructor({ strings: t, _$litType$: e }, s) {
    let o;
    this.parts = [];
    let r = 0, n = 0;
    const a = t.length - 1, l = this.parts, [c, h] = Pt(t, e);
    if (this.el = R.createElement(c, s), A.currentNode = this.el.content, e === 2 || e === 3) {
      const d = this.el.content.firstChild;
      d.replaceWith(...d.childNodes);
    }
    for (; (o = A.nextNode()) !== null && l.length < a; ) {
      if (o.nodeType === 1) {
        if (o.hasAttributes()) for (const d of o.getAttributeNames()) if (d.endsWith(pt)) {
          const v = h[n++], g = o.getAttribute(d).split(x), I = /([.?@])?(.*)/.exec(v);
          l.push({ type: 1, index: r, name: I[2], strings: g, ctor: I[1] === "." ? Ht : I[1] === "?" ? Tt : I[1] === "@" ? Dt : B }), o.removeAttribute(d);
        } else d.startsWith(x) && (l.push({ type: 6, index: r }), o.removeAttribute(d));
        if (mt.test(o.tagName)) {
          const d = o.textContent.split(x), v = d.length - 1;
          if (v > 0) {
            o.textContent = L ? L.emptyScript : "";
            for (let g = 0; g < v; g++) o.append(d[g], O()), A.nextNode(), l.push({ type: 2, index: ++r });
            o.append(d[v], O());
          }
        }
      } else if (o.nodeType === 8) if (o.data === ut) l.push({ type: 2, index: r });
      else {
        let d = -1;
        for (; (d = o.data.indexOf(x, d + 1)) !== -1; ) l.push({ type: 7, index: r }), d += x.length - 1;
      }
      r++;
    }
  }
  static createElement(t, e) {
    const s = E.createElement("template");
    return s.innerHTML = t, s;
  }
}
function P(i, t, e = i, s) {
  var n, a;
  if (t === M) return t;
  let o = s !== void 0 ? (n = e._$Co) == null ? void 0 : n[s] : e._$Cl;
  const r = U(t) ? void 0 : t._$litDirective$;
  return (o == null ? void 0 : o.constructor) !== r && ((a = o == null ? void 0 : o._$AO) == null || a.call(o, !1), r === void 0 ? o = void 0 : (o = new r(i), o._$AT(i, e, s)), s !== void 0 ? (e._$Co ?? (e._$Co = []))[s] = o : e._$Cl = o), o !== void 0 && (t = P(i, o._$AS(i, t.values), o, s)), t;
}
class Ct {
  constructor(t, e) {
    this._$AV = [], this._$AN = void 0, this._$AD = t, this._$AM = e;
  }
  get parentNode() {
    return this._$AM.parentNode;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  u(t) {
    const { el: { content: e }, parts: s } = this._$AD, o = ((t == null ? void 0 : t.creationScope) ?? E).importNode(e, !0);
    A.currentNode = o;
    let r = A.nextNode(), n = 0, a = 0, l = s[0];
    for (; l !== void 0; ) {
      if (n === l.index) {
        let c;
        l.type === 2 ? c = new F(r, r.nextSibling, this, t) : l.type === 1 ? c = new l.ctor(r, l.name, l.strings, this, t) : l.type === 6 && (c = new Nt(r, this, t)), this._$AV.push(c), l = s[++a];
      }
      n !== (l == null ? void 0 : l.index) && (r = A.nextNode(), n++);
    }
    return A.currentNode = E, o;
  }
  p(t) {
    let e = 0;
    for (const s of this._$AV) s !== void 0 && (s.strings !== void 0 ? (s._$AI(t, s, e), e += s.strings.length - 2) : s._$AI(t[e])), e++;
  }
}
class F {
  get _$AU() {
    var t;
    return ((t = this._$AM) == null ? void 0 : t._$AU) ?? this._$Cv;
  }
  constructor(t, e, s, o) {
    this.type = 2, this._$AH = u, this._$AN = void 0, this._$AA = t, this._$AB = e, this._$AM = s, this.options = o, this._$Cv = (o == null ? void 0 : o.isConnected) ?? !0;
  }
  get parentNode() {
    let t = this._$AA.parentNode;
    const e = this._$AM;
    return e !== void 0 && (t == null ? void 0 : t.nodeType) === 11 && (t = e.parentNode), t;
  }
  get startNode() {
    return this._$AA;
  }
  get endNode() {
    return this._$AB;
  }
  _$AI(t, e = this) {
    t = P(this, t, e), U(t) ? t === u || t == null || t === "" ? (this._$AH !== u && this._$AR(), this._$AH = u) : t !== this._$AH && t !== M && this._(t) : t._$litType$ !== void 0 ? this.$(t) : t.nodeType !== void 0 ? this.T(t) : kt(t) ? this.k(t) : this._(t);
  }
  O(t) {
    return this._$AA.parentNode.insertBefore(t, this._$AB);
  }
  T(t) {
    this._$AH !== t && (this._$AR(), this._$AH = this.O(t));
  }
  _(t) {
    this._$AH !== u && U(this._$AH) ? this._$AA.nextSibling.data = t : this.T(E.createTextNode(t)), this._$AH = t;
  }
  $(t) {
    var r;
    const { values: e, _$litType$: s } = t, o = typeof s == "number" ? this._$AC(t) : (s.el === void 0 && (s.el = R.createElement(ft(s.h, s.h[0]), this.options)), s);
    if (((r = this._$AH) == null ? void 0 : r._$AD) === o) this._$AH.p(e);
    else {
      const n = new Ct(o, this), a = n.u(this.options);
      n.p(e), this.T(a), this._$AH = n;
    }
  }
  _$AC(t) {
    let e = ct.get(t.strings);
    return e === void 0 && ct.set(t.strings, e = new R(t)), e;
  }
  k(t) {
    G(this._$AH) || (this._$AH = [], this._$AR());
    const e = this._$AH;
    let s, o = 0;
    for (const r of t) o === e.length ? e.push(s = new F(this.O(O()), this.O(O()), this, this.options)) : s = e[o], s._$AI(r), o++;
    o < e.length && (this._$AR(s && s._$AB.nextSibling, o), e.length = o);
  }
  _$AR(t = this._$AA.nextSibling, e) {
    var s;
    for ((s = this._$AP) == null ? void 0 : s.call(this, !1, !0, e); t !== this._$AB; ) {
      const o = it(t).nextSibling;
      it(t).remove(), t = o;
    }
  }
  setConnected(t) {
    var e;
    this._$AM === void 0 && (this._$Cv = t, (e = this._$AP) == null || e.call(this, t));
  }
}
class B {
  get tagName() {
    return this.element.tagName;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  constructor(t, e, s, o, r) {
    this.type = 1, this._$AH = u, this._$AN = void 0, this.element = t, this.name = e, this._$AM = o, this.options = r, s.length > 2 || s[0] !== "" || s[1] !== "" ? (this._$AH = Array(s.length - 1).fill(new String()), this.strings = s) : this._$AH = u;
  }
  _$AI(t, e = this, s, o) {
    const r = this.strings;
    let n = !1;
    if (r === void 0) t = P(this, t, e, 0), n = !U(t) || t !== this._$AH && t !== M, n && (this._$AH = t);
    else {
      const a = t;
      let l, c;
      for (t = r[0], l = 0; l < r.length - 1; l++) c = P(this, a[s + l], e, l), c === M && (c = this._$AH[l]), n || (n = !U(c) || c !== this._$AH[l]), c === u ? t = u : t !== u && (t += (c ?? "") + r[l + 1]), this._$AH[l] = c;
    }
    n && !o && this.j(t);
  }
  j(t) {
    t === u ? this.element.removeAttribute(this.name) : this.element.setAttribute(this.name, t ?? "");
  }
}
class Ht extends B {
  constructor() {
    super(...arguments), this.type = 3;
  }
  j(t) {
    this.element[this.name] = t === u ? void 0 : t;
  }
}
class Tt extends B {
  constructor() {
    super(...arguments), this.type = 4;
  }
  j(t) {
    this.element.toggleAttribute(this.name, !!t && t !== u);
  }
}
class Dt extends B {
  constructor(t, e, s, o, r) {
    super(t, e, s, o, r), this.type = 5;
  }
  _$AI(t, e = this) {
    if ((t = P(this, t, e, 0) ?? u) === M) return;
    const s = this._$AH, o = t === u && s !== u || t.capture !== s.capture || t.once !== s.once || t.passive !== s.passive, r = t !== u && (s === u || o);
    o && this.element.removeEventListener(this.name, this, s), r && this.element.addEventListener(this.name, this, t), this._$AH = t;
  }
  handleEvent(t) {
    var e;
    typeof this._$AH == "function" ? this._$AH.call(((e = this.options) == null ? void 0 : e.host) ?? this.element, t) : this._$AH.handleEvent(t);
  }
}
class Nt {
  constructor(t, e, s) {
    this.element = t, this.type = 6, this._$AN = void 0, this._$AM = e, this.options = s;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  _$AI(t) {
    P(this, t);
  }
}
const K = N.litHtmlPolyfillSupport;
K == null || K(R, F), (N.litHtmlVersions ?? (N.litHtmlVersions = [])).push("3.3.2");
const zt = (i, t, e) => {
  const s = (e == null ? void 0 : e.renderBefore) ?? t;
  let o = s._$litPart$;
  if (o === void 0) {
    const r = (e == null ? void 0 : e.renderBefore) ?? null;
    s._$litPart$ = o = new F(t.insertBefore(O(), r), r, void 0, e ?? {});
  }
  return o._$AI(i), o;
};
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const S = globalThis;
class z extends k {
  constructor() {
    super(...arguments), this.renderOptions = { host: this }, this._$Do = void 0;
  }
  createRenderRoot() {
    var e;
    const t = super.createRenderRoot();
    return (e = this.renderOptions).renderBefore ?? (e.renderBefore = t.firstChild), t;
  }
  update(t) {
    const e = this.render();
    this.hasUpdated || (this.renderOptions.isConnected = this.isConnected), super.update(t), this._$Do = zt(e, this.renderRoot, this.renderOptions);
  }
  connectedCallback() {
    var t;
    super.connectedCallback(), (t = this._$Do) == null || t.setConnected(!0);
  }
  disconnectedCallback() {
    var t;
    super.disconnectedCallback(), (t = this._$Do) == null || t.setConnected(!1);
  }
  render() {
    return M;
  }
}
var dt;
z._$litElement$ = !0, z.finalized = !0, (dt = S.litElementHydrateSupport) == null || dt.call(S, { LitElement: z });
const Y = S.litElementPolyfillSupport;
Y == null || Y({ LitElement: z });
(S.litElementVersions ?? (S.litElementVersions = [])).push("4.2.2");
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const Ot = (i) => (t, e) => {
  e !== void 0 ? e.addInitializer(() => {
    customElements.define(i, t);
  }) : customElements.define(i, t);
};
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const Ut = { attribute: !0, type: String, converter: j, reflect: !1, hasChanged: Z }, Rt = (i = Ut, t, e) => {
  const { kind: s, metadata: o } = e;
  let r = globalThis.litPropertyMetadata.get(o);
  if (r === void 0 && globalThis.litPropertyMetadata.set(o, r = /* @__PURE__ */ new Map()), s === "setter" && ((i = Object.create(i)).wrapped = !0), r.set(e.name, i), s === "accessor") {
    const { name: n } = e;
    return { set(a) {
      const l = t.get.call(this);
      t.set.call(this, a), this.requestUpdate(n, l, i, !0, a);
    }, init(a) {
      return a !== void 0 && this.C(n, void 0, i, a), a;
    } };
  }
  if (s === "setter") {
    const { name: n } = e;
    return function(a) {
      const l = this[n];
      t.call(this, a), this.requestUpdate(n, l, i, !0, a);
    };
  }
  throw Error("Unsupported decorator location: " + s);
};
function C(i) {
  return (t, e) => typeof e == "object" ? Rt(i, t, e) : ((s, o, r) => {
    const n = o.hasOwnProperty(r);
    return o.constructor.createProperty(r, s), n ? Object.getOwnPropertyDescriptor(o, r) : void 0;
  })(i, t, e);
}
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
function w(i) {
  return C({ ...i, state: !0, attribute: !1 });
}
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const Ft = (i, t, e) => (e.configurable = !0, e.enumerable = !0, Reflect.decorate && typeof t != "object" && Object.defineProperty(i, t, e), e);
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
function It(i, t) {
  return (e, s, o) => {
    const r = (n) => {
      var a;
      return ((a = n.renderRoot) == null ? void 0 : a.querySelector(i)) ?? null;
    };
    return Ft(e, s, { get() {
      return r(this);
    } });
  };
}
const Vt = "westmarches-dnd", T = `https://firestore.googleapis.com/v1/projects/${Vt}/databases/(default)/documents`;
class jt {
  constructor() {
    this.token = null;
  }
  setToken(t) {
    this.token = t;
  }
  headers() {
    const t = { "Content-Type": "application/json" };
    return this.token && (t.Authorization = `Bearer ${this.token}`), t;
  }
  // Parse Firestore document fields to JS object
  parseFields(t) {
    const e = {};
    for (const [s, o] of Object.entries(t))
      e[s] = this.parseValue(o);
    return e;
  }
  parseValue(t) {
    return t.stringValue !== void 0 ? t.stringValue : t.integerValue !== void 0 ? parseInt(t.integerValue) : t.doubleValue !== void 0 ? t.doubleValue : t.booleanValue !== void 0 ? t.booleanValue : t.nullValue !== void 0 ? null : t.timestampValue !== void 0 ? new Date(t.timestampValue) : t.arrayValue !== void 0 ? (t.arrayValue.values || []).map((e) => this.parseValue(e)) : t.mapValue !== void 0 ? this.parseFields(t.mapValue.fields || {}) : t;
  }
  // Convert JS value to Firestore format
  toFirestoreValue(t) {
    if (t == null) return { nullValue: null };
    if (typeof t == "string") return { stringValue: t };
    if (typeof t == "number")
      return Number.isInteger(t) ? { integerValue: String(t) } : { doubleValue: t };
    if (typeof t == "boolean") return { booleanValue: t };
    if (t instanceof Date) return { timestampValue: t.toISOString() };
    if (Array.isArray(t))
      return { arrayValue: { values: t.map((e) => this.toFirestoreValue(e)) } };
    if (typeof t == "object") {
      const e = {};
      for (const [s, o] of Object.entries(t))
        e[s] = this.toFirestoreValue(o);
      return { mapValue: { fields: e } };
    }
    return { stringValue: String(t) };
  }
  toFirestoreFields(t) {
    const e = {};
    for (const [s, o] of Object.entries(t))
      e[s] = this.toFirestoreValue(o);
    return e;
  }
  async getDocument(t, e) {
    try {
      const s = await fetch(`${T}/${t}/${e}`, {
        headers: this.headers()
      });
      if (!s.ok) {
        if (s.status === 404) return null;
        throw new Error(`Firestore error: ${s.status}`);
      }
      const o = await s.json();
      return { id: e, ...this.parseFields(o.fields || {}) };
    } catch (s) {
      return console.error("Firestore getDocument error:", s), null;
    }
  }
  async listDocuments(t, e = 100) {
    try {
      const s = await fetch(`${T}/${t}?pageSize=${e}`, {
        headers: this.headers()
      });
      if (!s.ok) throw new Error(`Firestore error: ${s.status}`);
      return ((await s.json()).documents || []).map((r) => {
        const n = r.name.split("/");
        return { id: n[n.length - 1], ...this.parseFields(r.fields || {}) };
      });
    } catch (s) {
      return console.error("Firestore listDocuments error:", s), [];
    }
  }
  async createDocument(t, e) {
    try {
      const s = await fetch(`${T}/${t}`, {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify({ fields: this.toFirestoreFields(e) })
      });
      if (!s.ok) throw new Error(`Firestore error: ${s.status}`);
      const o = await s.json(), r = o.name.split("/");
      return { id: r[r.length - 1], ...this.parseFields(o.fields || {}) };
    } catch (s) {
      return console.error("Firestore createDocument error:", s), null;
    }
  }
  async updateDocument(t, e, s) {
    try {
      const o = Object.keys(s).map((n) => `updateMask.fieldPaths=${n}`).join("&");
      return (await fetch(`${T}/${t}/${e}?${o}`, {
        method: "PATCH",
        headers: this.headers(),
        body: JSON.stringify({ fields: this.toFirestoreFields(s) })
      })).ok;
    } catch (o) {
      return console.error("Firestore updateDocument error:", o), !1;
    }
  }
  async deleteDocument(t, e) {
    try {
      return (await fetch(`${T}/${t}/${e}`, {
        method: "DELETE",
        headers: this.headers()
      })).ok;
    } catch (s) {
      return console.error("Firestore deleteDocument error:", s), !1;
    }
  }
}
const y = new jt();
var Lt = Object.defineProperty, Bt = Object.getOwnPropertyDescriptor, f = (i, t, e, s) => {
  for (var o = s > 1 ? void 0 : s ? Bt(t, e) : t, r = i.length - 1, n; r >= 0; r--)
    (n = i[r]) && (o = (s ? n(t, e, o) : n(o)) || o);
  return s && o && Lt(t, e, o), o;
};
const b = { gridW: 50, gridH: 50, hexSize: 30 };
let m = class extends z {
  constructor() {
    super(...arguments), this.authToken = "", this.userId = "", this.userName = "Anonymous", this.isAdmin = !1, this.isDm = !1, this.selectedHex = null, this.camera = { x: 25, y: 25, zoom: 1 }, this.hexData = {}, this.locations = [], this.features = [], this.hexNotes = [], this.loading = !0, this.modalType = null, this.ctx = null, this.dpr = 1, this.isPanning = !1, this.lastMouse = { x: 0, y: 0 }, this.terrainColors = {
      1: "#4a90d9",
      // Water
      2: "#c4b998",
      // Pale
      3: "#2d5a27",
      // Forest
      4: "#6b6b6b",
      // Mountain
      5: "#5a6b4a",
      // Swamp
      6: "#8fbc8f",
      // Plains
      7: "#9a8b7a",
      // Foothills
      9: "#2a5a8a",
      // Deep Water
      10: "#7cba7c",
      // Grass
      11: "#5a8a5a",
      // Dark Grass
      12: "#1a3a1a"
      // Dark Forest
    };
  }
  connectedCallback() {
    super.connectedCallback(), this.authToken && y.setToken(this.authToken), this.loadData();
  }
  updated(i) {
    i.has("authToken") && this.authToken && y.setToken(this.authToken);
  }
  firstUpdated() {
    this.setupCanvas(), this.setupInputListeners(), this.draw();
  }
  async loadData() {
    this.loading = !0;
    try {
      const [i, t, e] = await Promise.all([
        y.getDocument("maps", "world"),
        y.listDocuments("locations"),
        y.listDocuments("features")
      ]);
      i != null && i.hexes && (this.hexData = i.hexes), this.locations = t.filter((s) => !s.hidden || this.isAdmin || this.isDm), this.features = e.filter((s) => !s.hidden || this.isAdmin || this.isDm);
    } catch (i) {
      console.error("Failed to load map data:", i);
    }
    this.loading = !1, this.draw();
  }
  async loadHexNotes(i) {
    try {
      const t = await y.listDocuments("hexNotes");
      this.hexNotes = t.filter((e) => !(e.hexKey !== i || e.isPrivate && e.userId !== this.userId && !this.isAdmin && !this.isDm));
    } catch (t) {
      console.error("Failed to load hex notes:", t), this.hexNotes = [];
    }
  }
  setupCanvas() {
    const i = this.canvas.getBoundingClientRect();
    this.dpr = window.devicePixelRatio || 1, this.canvas.width = i.width * this.dpr, this.canvas.height = i.height * this.dpr, this.ctx = this.canvas.getContext("2d"), this.ctx.scale(this.dpr, this.dpr);
  }
  setupInputListeners() {
    this.canvas.addEventListener("mousedown", this.onMouseDown.bind(this)), this.canvas.addEventListener("mousemove", this.onMouseMove.bind(this)), this.canvas.addEventListener("mouseup", this.onMouseUp.bind(this)), this.canvas.addEventListener("wheel", this.onWheel.bind(this), { passive: !1 }), this.canvas.addEventListener("click", this.onClick.bind(this)), this.canvas.addEventListener("touchstart", this.onTouchStart.bind(this), { passive: !1 }), this.canvas.addEventListener("touchmove", this.onTouchMove.bind(this), { passive: !1 }), this.canvas.addEventListener("touchend", this.onTouchEnd.bind(this));
  }
  onMouseDown(i) {
    (i.button === 0 || i.button === 2) && (this.isPanning = !0, this.lastMouse = { x: i.clientX, y: i.clientY });
  }
  onMouseMove(i) {
    if (this.isPanning) {
      const t = i.clientX - this.lastMouse.x, e = i.clientY - this.lastMouse.y;
      this.camera.x -= t / (b.hexSize * this.camera.zoom), this.camera.y -= e / (b.hexSize * this.camera.zoom), this.lastMouse = { x: i.clientX, y: i.clientY }, this.draw();
    }
  }
  onMouseUp() {
    this.isPanning = !1;
  }
  onWheel(i) {
    i.preventDefault();
    const t = i.deltaY > 0 ? 0.9 : 1.1;
    this.camera.zoom = Math.max(0.3, Math.min(5, this.camera.zoom * t)), this.draw();
  }
  onClick(i) {
    if (this.isPanning) return;
    const t = this.screenToHex(i.offsetX, i.offsetY);
    t.x >= 0 && t.x < b.gridW && t.y >= 0 && t.y < b.gridH && (this.selectedHex = t, this.loadHexNotes(`${t.x}_${t.y}`));
  }
  onTouchStart(i) {
    if (i.touches.length === 1) {
      i.preventDefault();
      const t = i.touches[0];
      this.isPanning = !0, this.lastMouse = { x: t.clientX, y: t.clientY };
    }
  }
  onTouchMove(i) {
    if (i.touches.length === 1 && this.isPanning) {
      i.preventDefault();
      const t = i.touches[0], e = t.clientX - this.lastMouse.x, s = t.clientY - this.lastMouse.y;
      this.camera.x -= e / (b.hexSize * this.camera.zoom), this.camera.y -= s / (b.hexSize * this.camera.zoom), this.lastMouse = { x: t.clientX, y: t.clientY }, this.draw();
    }
  }
  onTouchEnd() {
    this.isPanning = !1;
  }
  screenToHex(i, t) {
    const e = b.hexSize * this.camera.zoom, s = this.canvas.getBoundingClientRect(), o = s.width / 2, r = s.height / 2, n = (i - o) / e + this.camera.x, a = (t - r) / e + this.camera.y, l = (n * Math.sqrt(3) / 3 - a / 3) / 0.866, c = a * 2 / 3 / 0.866;
    let h = Math.round(l), d = Math.round(c);
    return { x: h, y: d };
  }
  hexToScreen(i, t) {
    const e = b.hexSize * this.camera.zoom, s = this.canvas.getBoundingClientRect(), o = s.width / 2, r = s.height / 2, n = e * 0.866 * (i + 0.5 * (t & 1)), a = e * 0.75 * t;
    return {
      x: n - this.camera.x * e + o,
      y: a - this.camera.y * e + r
    };
  }
  draw() {
    var r, n;
    if (!this.ctx) return;
    const i = this.ctx, t = this.canvas.getBoundingClientRect(), e = t.width, s = t.height;
    i.clearRect(0, 0, e, s), i.fillStyle = "#0a0a0a", i.fillRect(0, 0, e, s);
    const o = b.hexSize * this.camera.zoom;
    for (let a = 0; a < b.gridH; a++)
      for (let l = 0; l < b.gridW; l++) {
        const c = this.hexToScreen(l, a);
        if (c.x < -o * 2 || c.x > e + o * 2 || c.y < -o * 2 || c.y > s + o * 2) continue;
        const h = `${l}_${a}`, d = this.hexData[h], v = (d == null ? void 0 : d.type) || 10;
        this.drawHex(i, c.x, c.y, o * 0.9, this.terrainColors[v] || "#444"), ((r = this.selectedHex) == null ? void 0 : r.x) === l && ((n = this.selectedHex) == null ? void 0 : n.y) === a && this.drawHex(i, c.x, c.y, o * 0.9, "rgba(239, 35, 60, 0.3)", !0);
      }
    for (const a of this.locations) {
      if (!a.hexKey) continue;
      const [l, c] = a.hexKey.split("_").map(Number), h = this.hexToScreen(l, c);
      this.drawMarker(i, h.x, h.y, "🏰", o * 0.4);
    }
    for (const a of this.features) {
      if (!a.hexKey) continue;
      const [l, c] = a.hexKey.split("_").map(Number), h = this.hexToScreen(l, c);
      this.drawMarker(i, h.x, h.y - o * 0.3, "📍", o * 0.3);
    }
  }
  drawHex(i, t, e, s, o, r = !1) {
    i.beginPath();
    for (let n = 0; n < 6; n++) {
      const a = Math.PI / 180 * (60 * n - 30), l = t + s * Math.cos(a), c = e + s * Math.sin(a);
      n === 0 ? i.moveTo(l, c) : i.lineTo(l, c);
    }
    i.closePath(), r ? (i.strokeStyle = o, i.lineWidth = 3, i.stroke()) : (i.fillStyle = o, i.fill(), i.strokeStyle = "rgba(0,0,0,0.3)", i.lineWidth = 1, i.stroke());
  }
  drawMarker(i, t, e, s, o) {
    i.font = `${o}px sans-serif`, i.textAlign = "center", i.textBaseline = "middle", i.fillText(s, t, e);
  }
  zoomIn() {
    this.camera.zoom = Math.min(5, this.camera.zoom * 1.2), this.draw();
  }
  zoomOut() {
    this.camera.zoom = Math.max(0.3, this.camera.zoom / 1.2), this.draw();
  }
  closePanel() {
    this.selectedHex = null, this.hexNotes = [];
  }
  getLocationsInHex(i) {
    return this.locations.filter((t) => t.hexKey === i);
  }
  getFeaturesInHex(i) {
    return this.features.filter((t) => t.hexKey === i);
  }
  openModal(i) {
    this.modalType = i;
  }
  closeModal() {
    this.modalType = null;
  }
  async saveLocation(i) {
    i.preventDefault();
    const t = i.target, e = new FormData(t), s = {
      name: e.get("name"),
      type: e.get("type"),
      description: e.get("description"),
      hexKey: this.selectedHex ? `${this.selectedHex.x}_${this.selectedHex.y}` : null,
      hidden: e.get("hidden") === "on",
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    }, o = await y.createDocument("locations", s);
    o && (this.locations = [...this.locations, o], this.closeModal(), this.draw());
  }
  async saveFeature(i) {
    i.preventDefault();
    const t = i.target, e = new FormData(t), s = {
      name: e.get("name"),
      type: e.get("type"),
      description: e.get("description"),
      hexKey: this.selectedHex ? `${this.selectedHex.x}_${this.selectedHex.y}` : null,
      hidden: e.get("hidden") === "on",
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    }, o = await y.createDocument("features", s);
    o && (this.features = [...this.features, o], this.closeModal(), this.draw());
  }
  async saveNote(i) {
    i.preventDefault();
    const t = i.target, e = new FormData(t), s = {
      content: e.get("content"),
      isPrivate: e.get("isPrivate") === "on",
      hexKey: this.selectedHex ? `${this.selectedHex.x}_${this.selectedHex.y}` : "",
      userId: this.userId,
      authorName: this.userName,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    }, o = await y.createDocument("hexNotes", s);
    o && (this.hexNotes = [...this.hexNotes, o], this.closeModal());
  }
  render() {
    const i = this.selectedHex ? `${this.selectedHex.x}_${this.selectedHex.y}` : null, t = i ? this.getLocationsInHex(i) : [], e = i ? this.getFeaturesInHex(i) : [];
    return p`
      <div class="container">
        <div class="map-area">
          <canvas></canvas>
          
          <div class="controls">
            <button class="control-btn" @click=${this.zoomIn}>+</button>
            <button class="control-btn" @click=${this.zoomOut}>−</button>
          </div>

          ${this.selectedHex ? p`
            <div class="hex-info">
              Hex: <span class="coords">${this.selectedHex.x}, ${this.selectedHex.y}</span>
            </div>
          ` : ""}
        </div>

        ${this.selectedHex ? p`
          <div class="detail-panel">
            <div class="detail-header">
              <span class="detail-title">Hex ${this.selectedHex.x}, ${this.selectedHex.y}</span>
              <button class="close-btn" @click=${this.closePanel}>✕</button>
            </div>
            <div class="detail-content">
              <!-- Locations -->
              <div class="section">
                <div class="section-title">🏰 Locations</div>
                ${t.length > 0 ? p`
                  <div class="item-list">
                    ${t.map((s) => p`
                      <div class="item">
                        <div class="item-name">${s.name}</div>
                        <div class="item-type">${s.type}</div>
                      </div>
                    `)}
                  </div>
                ` : p`<div class="empty-state">No locations</div>`}
                <button class="add-btn" @click=${() => this.openModal("location")}>+ Add Location</button>
              </div>

              <!-- Features -->
              <div class="section">
                <div class="section-title">📍 Points of Interest</div>
                ${e.length > 0 ? p`
                  <div class="item-list">
                    ${e.map((s) => p`
                      <div class="item">
                        <div class="item-name">${s.name}</div>
                        <div class="item-type">${s.type}</div>
                      </div>
                    `)}
                  </div>
                ` : p`<div class="empty-state">No features</div>`}
                <button class="add-btn" @click=${() => this.openModal("feature")}>+ Add Feature</button>
              </div>

              <!-- Notes -->
              <div class="section">
                <div class="section-title">📝 Notes</div>
                ${this.hexNotes.length > 0 ? p`
                  ${this.hexNotes.map((s) => p`
                    <div class="note">
                      <div class="note-header">
                        <span class="note-author">${s.authorName}</span>
                        ${s.isPrivate ? p`<span class="note-private">Private</span>` : ""}
                      </div>
                      <div class="note-content">${s.content}</div>
                    </div>
                  `)}
                ` : p`<div class="empty-state">No notes</div>`}
                <button class="add-btn" @click=${() => this.openModal("note")}>+ Add Note</button>
              </div>
            </div>
          </div>
        ` : ""}

        <!-- Modals -->
        ${this.modalType === "location" ? p`
          <div class="modal-backdrop" @click=${this.closeModal}>
            <div class="modal" @click=${(s) => s.stopPropagation()}>
              <div class="modal-header">
                <span class="modal-title">Add Location</span>
                <button class="close-btn" @click=${this.closeModal}>✕</button>
              </div>
              <form @submit=${this.saveLocation}>
                <div class="modal-body">
                  <div class="form-group">
                    <label>Name</label>
                    <input type="text" name="name" required placeholder="Location name...">
                  </div>
                  <div class="form-group">
                    <label>Type</label>
                    <select name="type">
                      <option value="city">City</option>
                      <option value="town">Town</option>
                      <option value="village">Village</option>
                      <option value="castle">Castle</option>
                      <option value="fortress">Fortress</option>
                      <option value="ruins">Ruins</option>
                      <option value="camp">Camp</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div class="form-group">
                    <label>Description</label>
                    <textarea name="description" placeholder="Description..."></textarea>
                  </div>
                  ${this.isAdmin || this.isDm ? p`
                    <div class="form-group">
                      <label class="checkbox-row">
                        <input type="checkbox" name="hidden">
                        Hidden from players
                      </label>
                    </div>
                  ` : ""}
                </div>
                <div class="modal-footer">
                  <button type="button" class="btn btn-secondary" @click=${this.closeModal}>Cancel</button>
                  <button type="submit" class="btn btn-primary">Create</button>
                </div>
              </form>
            </div>
          </div>
        ` : ""}

        ${this.modalType === "feature" ? p`
          <div class="modal-backdrop" @click=${this.closeModal}>
            <div class="modal" @click=${(s) => s.stopPropagation()}>
              <div class="modal-header">
                <span class="modal-title">Add Point of Interest</span>
                <button class="close-btn" @click=${this.closeModal}>✕</button>
              </div>
              <form @submit=${this.saveFeature}>
                <div class="modal-body">
                  <div class="form-group">
                    <label>Name</label>
                    <input type="text" name="name" required placeholder="Feature name...">
                  </div>
                  <div class="form-group">
                    <label>Type</label>
                    <select name="type">
                      <option value="inn">Inn</option>
                      <option value="tavern">Tavern</option>
                      <option value="shop">Shop</option>
                      <option value="temple">Temple</option>
                      <option value="shrine">Shrine</option>
                      <option value="blacksmith">Blacksmith</option>
                      <option value="guild">Guild</option>
                      <option value="cave">Cave</option>
                      <option value="ruins">Ruins</option>
                      <option value="monument">Monument</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div class="form-group">
                    <label>Description</label>
                    <textarea name="description" placeholder="Description..."></textarea>
                  </div>
                  ${this.isAdmin || this.isDm ? p`
                    <div class="form-group">
                      <label class="checkbox-row">
                        <input type="checkbox" name="hidden">
                        Hidden from players
                      </label>
                    </div>
                  ` : ""}
                </div>
                <div class="modal-footer">
                  <button type="button" class="btn btn-secondary" @click=${this.closeModal}>Cancel</button>
                  <button type="submit" class="btn btn-primary">Create</button>
                </div>
              </form>
            </div>
          </div>
        ` : ""}

        ${this.modalType === "note" ? p`
          <div class="modal-backdrop" @click=${this.closeModal}>
            <div class="modal" @click=${(s) => s.stopPropagation()}>
              <div class="modal-header">
                <span class="modal-title">Add Note</span>
                <button class="close-btn" @click=${this.closeModal}>✕</button>
              </div>
              <form @submit=${this.saveNote}>
                <div class="modal-body">
                  <div class="form-group">
                    <label>Note</label>
                    <textarea name="content" required placeholder="Write your note..."></textarea>
                  </div>
                  <div class="form-group">
                    <label class="checkbox-row">
                      <input type="checkbox" name="isPrivate">
                      Private (only visible to you and DMs)
                    </label>
                  </div>
                </div>
                <div class="modal-footer">
                  <button type="button" class="btn btn-secondary" @click=${this.closeModal}>Cancel</button>
                  <button type="submit" class="btn btn-primary">Save Note</button>
                </div>
              </form>
            </div>
          </div>
        ` : ""}
      </div>
    `;
  }
};
m.styles = bt`
    :host {
      display: block;
      width: 100%;
      height: 100%;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      --wm-accent: #ef233c;
      --wm-bg: #1a1a1a;
      --wm-bg-secondary: #252525;
      --wm-text: #e4e4e4;
      --wm-text-muted: #888;
      --wm-border: rgba(255, 255, 255, 0.1);
    }

    .container {
      display: flex;
      width: 100%;
      height: 100%;
      background: var(--wm-bg);
      color: var(--wm-text);
      position: relative;
      overflow: hidden;
    }

    .map-area {
      flex: 1;
      position: relative;
      min-width: 0;
    }

    canvas {
      display: block;
      width: 100%;
      height: 100%;
      cursor: grab;
    }

    canvas:active {
      cursor: grabbing;
    }

    .controls {
      position: absolute;
      top: 12px;
      left: 12px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      z-index: 10;
    }

    .control-btn {
      width: 36px;
      height: 36px;
      background: var(--wm-bg-secondary);
      border: 1px solid var(--wm-border);
      border-radius: 8px;
      color: var(--wm-text);
      font-size: 18px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.15s;
    }

    .control-btn:hover {
      background: rgba(239, 35, 60, 0.2);
      border-color: var(--wm-accent);
    }

    .hex-info {
      position: absolute;
      top: 12px;
      right: 12px;
      background: var(--wm-bg-secondary);
      border: 1px solid var(--wm-border);
      border-radius: 8px;
      padding: 8px 12px;
      font-size: 13px;
      z-index: 10;
    }

    .hex-info .coords {
      color: var(--wm-accent);
      font-family: monospace;
    }

    /* Detail Panel */
    .detail-panel {
      width: 320px;
      background: var(--wm-bg);
      border-left: 1px solid var(--wm-border);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .detail-header {
      padding: 16px;
      border-bottom: 1px solid var(--wm-border);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .detail-title {
      font-size: 16px;
      font-weight: 600;
      color: var(--wm-accent);
    }

    .close-btn {
      background: none;
      border: none;
      color: var(--wm-text-muted);
      font-size: 20px;
      cursor: pointer;
      padding: 4px;
    }

    .close-btn:hover {
      color: var(--wm-text);
    }

    .detail-content {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
    }

    .section {
      margin-bottom: 20px;
    }

    .section-title {
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--wm-text-muted);
      margin-bottom: 8px;
    }

    .item-list {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .item {
      padding: 10px 12px;
      background: var(--wm-bg-secondary);
      border: 1px solid var(--wm-border);
      border-radius: 8px;
      font-size: 13px;
      cursor: pointer;
      transition: all 0.15s;
    }

    .item:hover {
      border-color: var(--wm-accent);
    }

    .item-name {
      font-weight: 500;
    }

    .item-type {
      font-size: 11px;
      color: var(--wm-text-muted);
      margin-top: 2px;
    }

    .empty-state {
      text-align: center;
      padding: 20px;
      color: var(--wm-text-muted);
      font-size: 13px;
    }

    .add-btn {
      width: 100%;
      padding: 10px;
      background: rgba(239, 35, 60, 0.1);
      border: 1px dashed rgba(239, 35, 60, 0.3);
      border-radius: 8px;
      color: var(--wm-accent);
      font-size: 13px;
      cursor: pointer;
      transition: all 0.15s;
    }

    .add-btn:hover {
      background: rgba(239, 35, 60, 0.2);
      border-style: solid;
    }

    /* Modal */
    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.7);
      z-index: 100;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .modal {
      background: var(--wm-bg);
      border: 1px solid var(--wm-border);
      border-radius: 12px;
      width: 90%;
      max-width: 400px;
      max-height: 80vh;
      overflow-y: auto;
    }

    .modal-header {
      padding: 16px;
      border-bottom: 1px solid var(--wm-border);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .modal-title {
      font-size: 16px;
      font-weight: 600;
    }

    .modal-body {
      padding: 16px;
    }

    .form-group {
      margin-bottom: 16px;
    }

    .form-group label {
      display: block;
      font-size: 12px;
      color: var(--wm-text-muted);
      margin-bottom: 6px;
    }

    .form-group input,
    .form-group textarea,
    .form-group select {
      width: 100%;
      padding: 10px 12px;
      background: var(--wm-bg-secondary);
      border: 1px solid var(--wm-border);
      border-radius: 8px;
      color: var(--wm-text);
      font-size: 14px;
      font-family: inherit;
      outline: none;
    }

    .form-group input:focus,
    .form-group textarea:focus,
    .form-group select:focus {
      border-color: var(--wm-accent);
    }

    .form-group textarea {
      resize: vertical;
      min-height: 80px;
    }

    .checkbox-row {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
    }

    .modal-footer {
      padding: 12px 16px;
      border-top: 1px solid var(--wm-border);
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }

    .btn {
      padding: 10px 16px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      border: none;
      transition: all 0.15s;
    }

    .btn-primary {
      background: var(--wm-accent);
      color: white;
    }

    .btn-primary:hover {
      opacity: 0.9;
    }

    .btn-secondary {
      background: var(--wm-bg-secondary);
      color: var(--wm-text);
      border: 1px solid var(--wm-border);
    }

    .btn-secondary:hover {
      background: rgba(255, 255, 255, 0.1);
    }

    .note {
      padding: 12px;
      background: var(--wm-bg-secondary);
      border: 1px solid var(--wm-border);
      border-radius: 8px;
      margin-bottom: 8px;
    }

    .note-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 6px;
    }

    .note-author {
      font-size: 12px;
      color: var(--wm-accent);
      font-weight: 500;
    }

    .note-private {
      font-size: 10px;
      background: rgba(255, 255, 255, 0.1);
      padding: 2px 6px;
      border-radius: 4px;
      color: var(--wm-text-muted);
    }

    .note-content {
      font-size: 13px;
      line-height: 1.4;
    }
  `;
f([
  C({ type: String })
], m.prototype, "authToken", 2);
f([
  C({ type: String })
], m.prototype, "userId", 2);
f([
  C({ type: String })
], m.prototype, "userName", 2);
f([
  C({ type: Boolean })
], m.prototype, "isAdmin", 2);
f([
  C({ type: Boolean })
], m.prototype, "isDm", 2);
f([
  w()
], m.prototype, "selectedHex", 2);
f([
  w()
], m.prototype, "camera", 2);
f([
  w()
], m.prototype, "hexData", 2);
f([
  w()
], m.prototype, "locations", 2);
f([
  w()
], m.prototype, "features", 2);
f([
  w()
], m.prototype, "hexNotes", 2);
f([
  w()
], m.prototype, "loading", 2);
f([
  w()
], m.prototype, "modalType", 2);
f([
  It("canvas")
], m.prototype, "canvas", 2);
m = f([
  Ot("wm-map")
], m);
console.log("West Marches Web Components loaded");
export {
  m as WmMap,
  y as firestore
};
