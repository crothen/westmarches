/**
 * @license
 * Copyright 2019 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const F = globalThis, G = F.ShadowRoot && (F.ShadyCSS === void 0 || F.ShadyCSS.nativeShadow) && "adoptedStyleSheets" in Document.prototype && "replace" in CSSStyleSheet.prototype, Q = Symbol(), it = /* @__PURE__ */ new WeakMap();
let ft = class {
  constructor(t, e, s) {
    if (this._$cssResult$ = !0, s !== Q) throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");
    this.cssText = t, this.t = e;
  }
  get styleSheet() {
    let t = this.o;
    const e = this.t;
    if (G && t === void 0) {
      const s = e !== void 0 && e.length === 1;
      s && (t = it.get(e)), t === void 0 && ((this.o = t = new CSSStyleSheet()).replaceSync(this.cssText), s && it.set(e, t));
    }
    return t;
  }
  toString() {
    return this.cssText;
  }
};
const bt = (i) => new ft(typeof i == "string" ? i : i + "", void 0, Q), wt = (i, ...t) => {
  const e = i.length === 1 ? i[0] : t.reduce((s, o, n) => s + ((r) => {
    if (r._$cssResult$ === !0) return r.cssText;
    if (typeof r == "number") return r;
    throw Error("Value passed to 'css' function must be a 'css' function result: " + r + ". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.");
  })(o) + i[n + 1], i[0]);
  return new ft(e, i, Q);
}, _t = (i, t) => {
  if (G) i.adoptedStyleSheets = t.map((e) => e instanceof CSSStyleSheet ? e : e.styleSheet);
  else for (const e of t) {
    const s = document.createElement("style"), o = F.litNonce;
    o !== void 0 && s.setAttribute("nonce", o), s.textContent = e.cssText, i.appendChild(s);
  }
}, ot = G ? (i) => i : (i) => i instanceof CSSStyleSheet ? ((t) => {
  let e = "";
  for (const s of t.cssRules) e += s.cssText;
  return bt(e);
})(i) : i;
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const { is: At, defineProperty: St, getOwnPropertyDescriptor: Et, getOwnPropertyNames: Pt, getOwnPropertySymbols: Ct, getPrototypeOf: Mt } = Object, A = globalThis, nt = A.trustedTypes, Tt = nt ? nt.emptyScript : "", X = A.reactiveElementPolyfillSupport, I = (i, t) => i, B = { toAttribute(i, t) {
  switch (t) {
    case Boolean:
      i = i ? Tt : null;
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
} }, tt = (i, t) => !At(i, t), rt = { attribute: !0, type: String, converter: B, reflect: !1, useDefault: !1, hasChanged: tt };
Symbol.metadata ?? (Symbol.metadata = Symbol("metadata")), A.litPropertyMetadata ?? (A.litPropertyMetadata = /* @__PURE__ */ new WeakMap());
let T = class extends HTMLElement {
  static addInitializer(t) {
    this._$Ei(), (this.l ?? (this.l = [])).push(t);
  }
  static get observedAttributes() {
    return this.finalize(), this._$Eh && [...this._$Eh.keys()];
  }
  static createProperty(t, e = rt) {
    if (e.state && (e.attribute = !1), this._$Ei(), this.prototype.hasOwnProperty(t) && ((e = Object.create(e)).wrapped = !0), this.elementProperties.set(t, e), !e.noAccessor) {
      const s = Symbol(), o = this.getPropertyDescriptor(t, s, e);
      o !== void 0 && St(this.prototype, t, o);
    }
  }
  static getPropertyDescriptor(t, e, s) {
    const { get: o, set: n } = Et(this.prototype, t) ?? { get() {
      return this[e];
    }, set(r) {
      this[e] = r;
    } };
    return { get: o, set(r) {
      const h = o == null ? void 0 : o.call(this);
      n == null || n.call(this, r), this.requestUpdate(t, h, s);
    }, configurable: !0, enumerable: !0 };
  }
  static getPropertyOptions(t) {
    return this.elementProperties.get(t) ?? rt;
  }
  static _$Ei() {
    if (this.hasOwnProperty(I("elementProperties"))) return;
    const t = Mt(this);
    t.finalize(), t.l !== void 0 && (this.l = [...t.l]), this.elementProperties = new Map(t.elementProperties);
  }
  static finalize() {
    if (this.hasOwnProperty(I("finalized"))) return;
    if (this.finalized = !0, this._$Ei(), this.hasOwnProperty(I("properties"))) {
      const e = this.properties, s = [...Pt(e), ...Ct(e)];
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
      for (const o of s) e.unshift(ot(o));
    } else t !== void 0 && e.push(ot(t));
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
    return _t(t, this.constructor.elementStyles), t;
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
    var n;
    const s = this.constructor.elementProperties.get(t), o = this.constructor._$Eu(t, s);
    if (o !== void 0 && s.reflect === !0) {
      const r = (((n = s.converter) == null ? void 0 : n.toAttribute) !== void 0 ? s.converter : B).toAttribute(e, s.type);
      this._$Em = t, r == null ? this.removeAttribute(o) : this.setAttribute(o, r), this._$Em = null;
    }
  }
  _$AK(t, e) {
    var n, r;
    const s = this.constructor, o = s._$Eh.get(t);
    if (o !== void 0 && this._$Em !== o) {
      const h = s.getPropertyOptions(o), a = typeof h.converter == "function" ? { fromAttribute: h.converter } : ((n = h.converter) == null ? void 0 : n.fromAttribute) !== void 0 ? h.converter : B;
      this._$Em = o;
      const c = a.fromAttribute(e, h.type);
      this[o] = c ?? ((r = this._$Ej) == null ? void 0 : r.get(o)) ?? c, this._$Em = null;
    }
  }
  requestUpdate(t, e, s, o = !1, n) {
    var r;
    if (t !== void 0) {
      const h = this.constructor;
      if (o === !1 && (n = this[t]), s ?? (s = h.getPropertyOptions(t)), !((s.hasChanged ?? tt)(n, e) || s.useDefault && s.reflect && n === ((r = this._$Ej) == null ? void 0 : r.get(t)) && !this.hasAttribute(h._$Eu(t, s)))) return;
      this.C(t, e, s);
    }
    this.isUpdatePending === !1 && (this._$ES = this._$EP());
  }
  C(t, e, { useDefault: s, reflect: o, wrapped: n }, r) {
    s && !(this._$Ej ?? (this._$Ej = /* @__PURE__ */ new Map())).has(t) && (this._$Ej.set(t, r ?? e ?? this[t]), n !== !0 || r !== void 0) || (this._$AL.has(t) || (this.hasUpdated || s || (e = void 0), this._$AL.set(t, e)), o === !0 && this._$Em !== t && (this._$Eq ?? (this._$Eq = /* @__PURE__ */ new Set())).add(t));
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
        for (const [n, r] of this._$Ep) this[n] = r;
        this._$Ep = void 0;
      }
      const o = this.constructor.elementProperties;
      if (o.size > 0) for (const [n, r] of o) {
        const { wrapped: h } = r, a = this[n];
        h !== !0 || this._$AL.has(n) || a === void 0 || this.C(n, void 0, r, a);
      }
    }
    let t = !1;
    const e = this._$AL;
    try {
      t = this.shouldUpdate(e), t ? (this.willUpdate(e), (s = this._$EO) == null || s.forEach((o) => {
        var n;
        return (n = o.hostUpdate) == null ? void 0 : n.call(o);
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
T.elementStyles = [], T.shadowRootOptions = { mode: "open" }, T[I("elementProperties")] = /* @__PURE__ */ new Map(), T[I("finalized")] = /* @__PURE__ */ new Map(), X == null || X({ ReactiveElement: T }), (A.reactiveElementVersions ?? (A.reactiveElementVersions = [])).push("2.1.2");
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const N = globalThis, at = (i) => i, q = N.trustedTypes, ht = q ? q.createPolicy("lit-html", { createHTML: (i) => i }) : void 0, gt = "$lit$", _ = `lit$${Math.random().toFixed(9).slice(2)}$`, yt = "?" + _, kt = `<${yt}>`, C = document, R = () => C.createComment(""), j = (i) => i === null || typeof i != "object" && typeof i != "function", et = Array.isArray, Ht = (i) => et(i) || typeof (i == null ? void 0 : i[Symbol.iterator]) == "function", K = `[ 	
\f\r]`, O = /<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g, ct = /-->/g, lt = />/g, S = RegExp(`>|${K}(?:([^\\s"'>=/]+)(${K}*=${K}*(?:[^ 	
\f\r"'\`<>=]|("|')|))|$)`, "g"), dt = /'/g, pt = /"/g, $t = /^(?:script|style|textarea|title)$/i, Dt = (i) => (t, ...e) => ({ _$litType$: i, strings: t, values: e }), $ = Dt(1), k = Symbol.for("lit-noChange"), u = Symbol.for("lit-nothing"), ut = /* @__PURE__ */ new WeakMap(), E = C.createTreeWalker(C, 129);
function vt(i, t) {
  if (!et(i) || !i.hasOwnProperty("raw")) throw Error("invalid template strings array");
  return ht !== void 0 ? ht.createHTML(t) : t;
}
const Ot = (i, t) => {
  const e = i.length - 1, s = [];
  let o, n = t === 2 ? "<svg>" : t === 3 ? "<math>" : "", r = O;
  for (let h = 0; h < e; h++) {
    const a = i[h];
    let c, d, l = -1, p = 0;
    for (; p < a.length && (r.lastIndex = p, d = r.exec(a), d !== null); ) p = r.lastIndex, r === O ? d[1] === "!--" ? r = ct : d[1] !== void 0 ? r = lt : d[2] !== void 0 ? ($t.test(d[2]) && (o = RegExp("</" + d[2], "g")), r = S) : d[3] !== void 0 && (r = S) : r === S ? d[0] === ">" ? (r = o ?? O, l = -1) : d[1] === void 0 ? l = -2 : (l = r.lastIndex - d[2].length, c = d[1], r = d[3] === void 0 ? S : d[3] === '"' ? pt : dt) : r === pt || r === dt ? r = S : r === ct || r === lt ? r = O : (r = S, o = void 0);
    const v = r === S && i[h + 1].startsWith("/>") ? " " : "";
    n += r === O ? a + kt : l >= 0 ? (s.push(c), a.slice(0, l) + gt + a.slice(l) + _ + v) : a + _ + (l === -2 ? h : v);
  }
  return [vt(i, n + (i[e] || "<?>") + (t === 2 ? "</svg>" : t === 3 ? "</math>" : "")), s];
};
class V {
  constructor({ strings: t, _$litType$: e }, s) {
    let o;
    this.parts = [];
    let n = 0, r = 0;
    const h = t.length - 1, a = this.parts, [c, d] = Ot(t, e);
    if (this.el = V.createElement(c, s), E.currentNode = this.el.content, e === 2 || e === 3) {
      const l = this.el.content.firstChild;
      l.replaceWith(...l.childNodes);
    }
    for (; (o = E.nextNode()) !== null && a.length < h; ) {
      if (o.nodeType === 1) {
        if (o.hasAttributes()) for (const l of o.getAttributeNames()) if (l.endsWith(gt)) {
          const p = d[r++], v = o.getAttribute(l).split(_), y = /([.?@])?(.*)/.exec(p);
          a.push({ type: 1, index: n, name: y[2], strings: v, ctor: y[1] === "." ? It : y[1] === "?" ? Nt : y[1] === "@" ? Ut : W }), o.removeAttribute(l);
        } else l.startsWith(_) && (a.push({ type: 6, index: n }), o.removeAttribute(l));
        if ($t.test(o.tagName)) {
          const l = o.textContent.split(_), p = l.length - 1;
          if (p > 0) {
            o.textContent = q ? q.emptyScript : "";
            for (let v = 0; v < p; v++) o.append(l[v], R()), E.nextNode(), a.push({ type: 2, index: ++n });
            o.append(l[p], R());
          }
        }
      } else if (o.nodeType === 8) if (o.data === yt) a.push({ type: 2, index: n });
      else {
        let l = -1;
        for (; (l = o.data.indexOf(_, l + 1)) !== -1; ) a.push({ type: 7, index: n }), l += _.length - 1;
      }
      n++;
    }
  }
  static createElement(t, e) {
    const s = C.createElement("template");
    return s.innerHTML = t, s;
  }
}
function H(i, t, e = i, s) {
  var r, h;
  if (t === k) return t;
  let o = s !== void 0 ? (r = e._$Co) == null ? void 0 : r[s] : e._$Cl;
  const n = j(t) ? void 0 : t._$litDirective$;
  return (o == null ? void 0 : o.constructor) !== n && ((h = o == null ? void 0 : o._$AO) == null || h.call(o, !1), n === void 0 ? o = void 0 : (o = new n(i), o._$AT(i, e, s)), s !== void 0 ? (e._$Co ?? (e._$Co = []))[s] = o : e._$Cl = o), o !== void 0 && (t = H(i, o._$AS(i, t.values), o, s)), t;
}
class zt {
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
    const { el: { content: e }, parts: s } = this._$AD, o = ((t == null ? void 0 : t.creationScope) ?? C).importNode(e, !0);
    E.currentNode = o;
    let n = E.nextNode(), r = 0, h = 0, a = s[0];
    for (; a !== void 0; ) {
      if (r === a.index) {
        let c;
        a.type === 2 ? c = new L(n, n.nextSibling, this, t) : a.type === 1 ? c = new a.ctor(n, a.name, a.strings, this, t) : a.type === 6 && (c = new Rt(n, this, t)), this._$AV.push(c), a = s[++h];
      }
      r !== (a == null ? void 0 : a.index) && (n = E.nextNode(), r++);
    }
    return E.currentNode = C, o;
  }
  p(t) {
    let e = 0;
    for (const s of this._$AV) s !== void 0 && (s.strings !== void 0 ? (s._$AI(t, s, e), e += s.strings.length - 2) : s._$AI(t[e])), e++;
  }
}
class L {
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
    t = H(this, t, e), j(t) ? t === u || t == null || t === "" ? (this._$AH !== u && this._$AR(), this._$AH = u) : t !== this._$AH && t !== k && this._(t) : t._$litType$ !== void 0 ? this.$(t) : t.nodeType !== void 0 ? this.T(t) : Ht(t) ? this.k(t) : this._(t);
  }
  O(t) {
    return this._$AA.parentNode.insertBefore(t, this._$AB);
  }
  T(t) {
    this._$AH !== t && (this._$AR(), this._$AH = this.O(t));
  }
  _(t) {
    this._$AH !== u && j(this._$AH) ? this._$AA.nextSibling.data = t : this.T(C.createTextNode(t)), this._$AH = t;
  }
  $(t) {
    var n;
    const { values: e, _$litType$: s } = t, o = typeof s == "number" ? this._$AC(t) : (s.el === void 0 && (s.el = V.createElement(vt(s.h, s.h[0]), this.options)), s);
    if (((n = this._$AH) == null ? void 0 : n._$AD) === o) this._$AH.p(e);
    else {
      const r = new zt(o, this), h = r.u(this.options);
      r.p(e), this.T(h), this._$AH = r;
    }
  }
  _$AC(t) {
    let e = ut.get(t.strings);
    return e === void 0 && ut.set(t.strings, e = new V(t)), e;
  }
  k(t) {
    et(this._$AH) || (this._$AH = [], this._$AR());
    const e = this._$AH;
    let s, o = 0;
    for (const n of t) o === e.length ? e.push(s = new L(this.O(R()), this.O(R()), this, this.options)) : s = e[o], s._$AI(n), o++;
    o < e.length && (this._$AR(s && s._$AB.nextSibling, o), e.length = o);
  }
  _$AR(t = this._$AA.nextSibling, e) {
    var s;
    for ((s = this._$AP) == null ? void 0 : s.call(this, !1, !0, e); t !== this._$AB; ) {
      const o = at(t).nextSibling;
      at(t).remove(), t = o;
    }
  }
  setConnected(t) {
    var e;
    this._$AM === void 0 && (this._$Cv = t, (e = this._$AP) == null || e.call(this, t));
  }
}
class W {
  get tagName() {
    return this.element.tagName;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  constructor(t, e, s, o, n) {
    this.type = 1, this._$AH = u, this._$AN = void 0, this.element = t, this.name = e, this._$AM = o, this.options = n, s.length > 2 || s[0] !== "" || s[1] !== "" ? (this._$AH = Array(s.length - 1).fill(new String()), this.strings = s) : this._$AH = u;
  }
  _$AI(t, e = this, s, o) {
    const n = this.strings;
    let r = !1;
    if (n === void 0) t = H(this, t, e, 0), r = !j(t) || t !== this._$AH && t !== k, r && (this._$AH = t);
    else {
      const h = t;
      let a, c;
      for (t = n[0], a = 0; a < n.length - 1; a++) c = H(this, h[s + a], e, a), c === k && (c = this._$AH[a]), r || (r = !j(c) || c !== this._$AH[a]), c === u ? t = u : t !== u && (t += (c ?? "") + n[a + 1]), this._$AH[a] = c;
    }
    r && !o && this.j(t);
  }
  j(t) {
    t === u ? this.element.removeAttribute(this.name) : this.element.setAttribute(this.name, t ?? "");
  }
}
class It extends W {
  constructor() {
    super(...arguments), this.type = 3;
  }
  j(t) {
    this.element[this.name] = t === u ? void 0 : t;
  }
}
class Nt extends W {
  constructor() {
    super(...arguments), this.type = 4;
  }
  j(t) {
    this.element.toggleAttribute(this.name, !!t && t !== u);
  }
}
class Ut extends W {
  constructor(t, e, s, o, n) {
    super(t, e, s, o, n), this.type = 5;
  }
  _$AI(t, e = this) {
    if ((t = H(this, t, e, 0) ?? u) === k) return;
    const s = this._$AH, o = t === u && s !== u || t.capture !== s.capture || t.once !== s.once || t.passive !== s.passive, n = t !== u && (s === u || o);
    o && this.element.removeEventListener(this.name, this, s), n && this.element.addEventListener(this.name, this, t), this._$AH = t;
  }
  handleEvent(t) {
    var e;
    typeof this._$AH == "function" ? this._$AH.call(((e = this.options) == null ? void 0 : e.host) ?? this.element, t) : this._$AH.handleEvent(t);
  }
}
class Rt {
  constructor(t, e, s) {
    this.element = t, this.type = 6, this._$AN = void 0, this._$AM = e, this.options = s;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  _$AI(t) {
    H(this, t);
  }
}
const Z = N.litHtmlPolyfillSupport;
Z == null || Z(V, L), (N.litHtmlVersions ?? (N.litHtmlVersions = [])).push("3.3.2");
const jt = (i, t, e) => {
  const s = (e == null ? void 0 : e.renderBefore) ?? t;
  let o = s._$litPart$;
  if (o === void 0) {
    const n = (e == null ? void 0 : e.renderBefore) ?? null;
    s._$litPart$ = o = new L(t.insertBefore(R(), n), n, void 0, e ?? {});
  }
  return o._$AI(i), o;
};
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const P = globalThis;
class U extends T {
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
    this.hasUpdated || (this.renderOptions.isConnected = this.isConnected), super.update(t), this._$Do = jt(e, this.renderRoot, this.renderOptions);
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
    return k;
  }
}
var mt;
U._$litElement$ = !0, U.finalized = !0, (mt = P.litElementHydrateSupport) == null || mt.call(P, { LitElement: U });
const J = P.litElementPolyfillSupport;
J == null || J({ LitElement: U });
(P.litElementVersions ?? (P.litElementVersions = [])).push("4.2.2");
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const Vt = (i) => (t, e) => {
  e !== void 0 ? e.addInitializer(() => {
    customElements.define(i, t);
  }) : customElements.define(i, t);
};
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const Lt = { attribute: !0, type: String, converter: B, reflect: !1, hasChanged: tt }, Ft = (i = Lt, t, e) => {
  const { kind: s, metadata: o } = e;
  let n = globalThis.litPropertyMetadata.get(o);
  if (n === void 0 && globalThis.litPropertyMetadata.set(o, n = /* @__PURE__ */ new Map()), s === "setter" && ((i = Object.create(i)).wrapped = !0), n.set(e.name, i), s === "accessor") {
    const { name: r } = e;
    return { set(h) {
      const a = t.get.call(this);
      t.set.call(this, h), this.requestUpdate(r, a, i, !0, h);
    }, init(h) {
      return h !== void 0 && this.C(r, void 0, i, h), h;
    } };
  }
  if (s === "setter") {
    const { name: r } = e;
    return function(h) {
      const a = this[r];
      t.call(this, h), this.requestUpdate(r, a, i, !0, h);
    };
  }
  throw Error("Unsupported decorator location: " + s);
};
function D(i) {
  return (t, e) => typeof e == "object" ? Ft(i, t, e) : ((s, o, n) => {
    const r = o.hasOwnProperty(n);
    return o.constructor.createProperty(n, s), r ? Object.getOwnPropertyDescriptor(o, n) : void 0;
  })(i, t, e);
}
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
function x(i) {
  return D({ ...i, state: !0, attribute: !1 });
}
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const Bt = (i, t, e) => (e.configurable = !0, e.enumerable = !0, Reflect.decorate && typeof t != "object" && Object.defineProperty(i, t, e), e);
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
function qt(i, t) {
  return (e, s, o) => {
    const n = (r) => {
      var h;
      return ((h = r.renderRoot) == null ? void 0 : h.querySelector(i)) ?? null;
    };
    return Bt(e, s, { get() {
      return n(this);
    } });
  };
}
const Wt = "westmarches-dnd", z = `https://firestore.googleapis.com/v1/projects/${Wt}/databases/(default)/documents`;
class Yt {
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
      const s = await fetch(`${z}/${t}/${e}`, {
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
      const s = await fetch(`${z}/${t}?pageSize=${e}`, {
        headers: this.headers()
      });
      if (!s.ok) throw new Error(`Firestore error: ${s.status}`);
      return ((await s.json()).documents || []).map((n) => {
        const r = n.name.split("/");
        return { id: r[r.length - 1], ...this.parseFields(n.fields || {}) };
      });
    } catch (s) {
      return console.error("Firestore listDocuments error:", s), [];
    }
  }
  async createDocument(t, e) {
    try {
      const s = await fetch(`${z}/${t}`, {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify({ fields: this.toFirestoreFields(e) })
      });
      if (!s.ok) throw new Error(`Firestore error: ${s.status}`);
      const o = await s.json(), n = o.name.split("/");
      return { id: n[n.length - 1], ...this.parseFields(o.fields || {}) };
    } catch (s) {
      return console.error("Firestore createDocument error:", s), null;
    }
  }
  async updateDocument(t, e, s) {
    try {
      const o = Object.keys(s).map((r) => `updateMask.fieldPaths=${r}`).join("&");
      return (await fetch(`${z}/${t}/${e}?${o}`, {
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
      return (await fetch(`${z}/${t}/${e}`, {
        method: "DELETE",
        headers: this.headers()
      })).ok;
    } catch (s) {
      return console.error("Firestore deleteDocument error:", s), !1;
    }
  }
}
const w = new Yt();
var Xt = Object.defineProperty, Kt = Object.getOwnPropertyDescriptor, f = (i, t, e, s) => {
  for (var o = s > 1 ? void 0 : s ? Kt(t, e) : t, n = i.length - 1, r; n >= 0; n--)
    (r = i[n]) && (o = (s ? r(t, e, o) : r(o)) || o);
  return s && o && Xt(t, e, o), o;
};
const g = { gridW: 50, gridH: 50, hexSize: 30 };
let m = class extends U {
  constructor() {
    super(...arguments), this.authToken = "", this.userId = "", this.userName = "Anonymous", this.isAdmin = !1, this.isDm = !1, this.selectedHex = null, this.camera = { x: 50, y: 50, zoom: 1 }, this.hexData = {}, this.locations = [], this.features = [], this.hexNotes = [], this.loading = !0, this.terrainConfig = {}, this.markerTypesConfig = { locationTypes: {}, featureTypes: {} }, this.ctx = null, this.dpr = 1, this.isPanning = !1, this.hasMoved = !1, this.lastMouse = { x: 0, y: 0 }, this.animationId = null, this.initialPinchDist = null, this.initialPinchZoom = 1, this.touchStartPos = null, this.terrainImages = {}, this.iconImages = {}, this.defaultTerrainColors = {
      1: "#4a90d9",
      // Water
      2: "#c4b998",
      // Pale/Desert
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
    super.connectedCallback(), this.authToken && w.setToken(this.authToken), this.loadData();
  }
  updated(i) {
    i.has("authToken") && this.authToken && w.setToken(this.authToken);
  }
  firstUpdated() {
    this.setupCanvas(), this.setupInputListeners(), this.fitToView(), this.draw();
  }
  disconnectedCallback() {
    super.disconnectedCallback(), this.animationId && cancelAnimationFrame(this.animationId);
  }
  async loadData() {
    this.loading = !0, console.log("[wm-map] loadData starting, authToken:", this.authToken ? "present" : "missing");
    try {
      const [i, t, e] = await Promise.all([
        w.getDocument("maps", "world"),
        w.listDocuments("locations"),
        w.listDocuments("features")
      ]);
      if (console.log("[wm-map] mapDoc:", i ? "loaded" : "null"), i != null && i.hexes) {
        this.hexData = i.hexes;
        const s = Object.keys(this.hexData).slice(0, 10);
        console.log("[wm-map] HexData sample keys:", s), console.log("[wm-map] Sample hex 1_1:", this.hexData["1_1"]), console.log("[wm-map] Sample hex 0_0:", this.hexData["0_0"]), console.log("[wm-map] Total hexes:", Object.keys(this.hexData).length);
      } else
        console.log("[wm-map] No hexes in mapDoc");
      this.locations = t.filter((s) => !s.hidden || this.isAdmin || this.isDm), this.features = e.filter((s) => !s.hidden || this.isAdmin || this.isDm);
      try {
        const s = await w.getDocument("config", "terrain");
        if (s) {
          for (const [o, n] of Object.entries(s)) {
            if (o === "id") continue;
            const r = parseInt(o);
            if (!isNaN(r) && typeof n == "object") {
              const h = n;
              this.terrainConfig[r] = {
                name: h.name || `Terrain ${r}`,
                color: h.color || "#666",
                texture: h.texture
              };
            }
          }
          console.log("[wm-map] Loaded terrain config:", Object.keys(this.terrainConfig).length, "types"), this.loadTerrainImages();
        }
      } catch {
        console.log("[wm-map] Using default terrain colors");
      }
      try {
        const s = await w.getDocument("config", "markerTypes");
        s && (this.markerTypesConfig = {
          locationTypes: s.locationTypes || {},
          featureTypes: s.featureTypes || {}
        }, console.log("[wm-map] Loaded marker types config"), this.loadIconImages());
      } catch {
        console.log("[wm-map] Using default icons");
      }
    } catch (i) {
      console.error("Failed to load map data:", i);
    }
    this.loading = !1, this.draw();
  }
  loadTerrainImages() {
    for (const [i, t] of Object.entries(this.terrainConfig)) {
      const e = parseInt(i);
      if (t.texture) {
        const s = new Image();
        s.crossOrigin = "anonymous", s.onload = () => {
          this.terrainImages[e] = s, this.requestDraw();
        }, s.src = t.texture;
      }
    }
  }
  loadIconImages() {
    for (const [i, t] of Object.entries(this.markerTypesConfig.locationTypes))
      if (t.iconUrl) {
        const e = new Image();
        e.crossOrigin = "anonymous", e.onload = () => {
          this.iconImages[`loc:${i}`] = e, this.requestDraw();
        }, e.src = t.iconUrl;
      }
    for (const [i, t] of Object.entries(this.markerTypesConfig.featureTypes))
      if (t.iconUrl) {
        const e = new Image();
        e.crossOrigin = "anonymous", e.onload = () => {
          this.iconImages[`feat:${i}`] = e, this.requestDraw();
        }, e.src = t.iconUrl;
      }
  }
  async loadHexNotes(i) {
    try {
      const t = await w.listDocuments("hexNotes");
      this.hexNotes = t.filter((e) => !(e.hexKey !== i || e.isPrivate && e.userId !== this.userId && !this.isAdmin && !this.isDm));
    } catch (t) {
      console.error("Failed to load hex notes:", t), this.hexNotes = [];
    }
  }
  setupCanvas() {
    const i = this.canvas.getBoundingClientRect();
    this.dpr = window.devicePixelRatio || 1, this.canvas.width = i.width * this.dpr, this.canvas.height = i.height * this.dpr, this.ctx = this.canvas.getContext("2d"), this.ctx.scale(this.dpr, this.dpr), new ResizeObserver(() => {
      const e = this.canvas.getBoundingClientRect();
      this.canvas.width = e.width * this.dpr, this.canvas.height = e.height * this.dpr, this.ctx = this.canvas.getContext("2d"), this.ctx.scale(this.dpr, this.dpr), this.draw();
    }).observe(this.canvas);
  }
  setupInputListeners() {
    this.canvas.addEventListener("mousedown", this.onMouseDown.bind(this)), this.canvas.addEventListener("mousemove", this.onMouseMove.bind(this)), this.canvas.addEventListener("mouseup", this.onMouseUp.bind(this)), this.canvas.addEventListener("mouseleave", this.onMouseUp.bind(this)), this.canvas.addEventListener("wheel", this.onWheel.bind(this), { passive: !1 }), this.canvas.addEventListener("click", this.onClick.bind(this)), this.canvas.addEventListener("touchstart", this.onTouchStart.bind(this), { passive: !1 }), this.canvas.addEventListener("touchmove", this.onTouchMove.bind(this), { passive: !1 }), this.canvas.addEventListener("touchend", this.onTouchEnd.bind(this));
  }
  onMouseDown(i) {
    (i.button === 0 || i.button === 2) && (this.isPanning = !0, this.hasMoved = !1, this.lastMouse = { x: i.clientX, y: i.clientY });
  }
  onMouseMove(i) {
    if (this.isPanning) {
      const t = i.clientX - this.lastMouse.x, e = i.clientY - this.lastMouse.y;
      (Math.abs(t) > 2 || Math.abs(e) > 2) && (this.hasMoved = !0), this.camera.x += t, this.camera.y += e, this.lastMouse = { x: i.clientX, y: i.clientY }, this.requestDraw();
    }
  }
  onMouseUp() {
    this.isPanning = !1;
  }
  onWheel(i) {
    i.preventDefault();
    const t = this.canvas.getBoundingClientRect(), e = i.clientX - t.left, s = i.clientY - t.top, o = i.deltaY > 0 ? 0.9 : 1.1, n = Math.max(0.3, Math.min(5, this.camera.zoom * o)), r = (e - this.camera.x) / this.camera.zoom, h = (s - this.camera.y) / this.camera.zoom;
    this.camera.zoom = n, this.camera.x = e - r * n, this.camera.y = s - h * n, this.requestDraw();
  }
  onClick(i) {
    if (this.hasMoved) return;
    const t = this.getHexAt(i.offsetX, i.offsetY);
    console.log("[wm-map] Click at", i.offsetX, i.offsetY, "-> hex:", t), t && t.x >= 1 && t.x <= g.gridW && t.y >= 1 && t.y <= g.gridH && (this.selectedHex = t, this.loadHexNotes(`${t.x}_${t.y}`), this.requestDraw());
  }
  onTouchStart(i) {
    if (i.preventDefault(), i.touches.length === 1) {
      const t = i.touches[0];
      this.isPanning = !0, this.hasMoved = !1, this.lastMouse = { x: t.clientX, y: t.clientY }, this.touchStartPos = { x: t.clientX, y: t.clientY };
    } else if (i.touches.length === 2) {
      this.isPanning = !1;
      const t = i.touches[0], e = i.touches[1];
      this.initialPinchDist = Math.hypot(e.clientX - t.clientX, e.clientY - t.clientY), this.initialPinchZoom = this.camera.zoom;
    }
  }
  onTouchMove(i) {
    if (i.preventDefault(), i.touches.length === 1 && this.isPanning) {
      const t = i.touches[0], e = t.clientX - this.lastMouse.x, s = t.clientY - this.lastMouse.y;
      (Math.abs(e) > 3 || Math.abs(s) > 3) && (this.hasMoved = !0), this.camera.x += e, this.camera.y += s, this.lastMouse = { x: t.clientX, y: t.clientY }, this.requestDraw();
    } else if (i.touches.length === 2 && this.initialPinchDist) {
      const t = i.touches[0], e = i.touches[1], o = Math.hypot(e.clientX - t.clientX, e.clientY - t.clientY) / this.initialPinchDist, n = this.canvas.getBoundingClientRect(), r = (t.clientX + e.clientX) / 2 - n.left, h = (t.clientY + e.clientY) / 2 - n.top, a = Math.max(0.3, Math.min(5, this.initialPinchZoom * o)), c = (r - this.camera.x) / this.camera.zoom, d = (h - this.camera.y) / this.camera.zoom;
      this.camera.zoom = a, this.camera.x = r - c * a, this.camera.y = h - d * a, this.hasMoved = !0, this.requestDraw();
    }
  }
  onTouchEnd(i) {
    if (!this.hasMoved && this.touchStartPos && i.changedTouches.length > 0) {
      const t = i.changedTouches[0], e = this.canvas.getBoundingClientRect(), s = t.clientX - e.left, o = t.clientY - e.top, n = this.getHexAt(s, o);
      n && n.x >= 1 && n.x <= g.gridW && n.y >= 1 && n.y <= g.gridH && (this.selectedHex = n, this.loadHexNotes(`${n.x}_${n.y}`), this.requestDraw());
    }
    this.isPanning = !1, this.initialPinchDist = null, this.touchStartPos = null;
  }
  // Match Vue's getHexCenter: flat-top hexes with offset coordinates
  getHexCenter(i, t) {
    const e = g.hexSize, s = i - 1, o = t - 1, n = s * 1.5 * e + e * 2, r = s % 2 * (Math.sqrt(3) * e / 2), h = o * Math.sqrt(3) * e + r + e * 2;
    return { x: n, y: h };
  }
  toWorld(i, t) {
    return {
      x: (i - this.camera.x) / this.camera.zoom,
      y: (t - this.camera.y) / this.camera.zoom
    };
  }
  getHexAt(i, t) {
    const e = this.toWorld(i, t);
    let s = null, o = 1 / 0;
    for (let n = 1; n <= g.gridW; n++)
      for (let r = 1; r <= g.gridH; r++) {
        const h = this.getHexCenter(n, r), a = Math.sqrt((e.x - h.x) ** 2 + (e.y - h.y) ** 2);
        a <= g.hexSize * 1.1 && a < o && (o = a, s = { x: n, y: r });
      }
    return s;
  }
  fitToView() {
    const i = this.canvas.getBoundingClientRect();
    if (!i.width || !i.height) return;
    const t = g.hexSize, e = this.getHexCenter(g.gridW, g.gridH), s = -t * 2, o = -t, n = e.x + t * 2, r = e.y + t * 2, h = n - s, a = r - o, c = 20, d = i.width - c * 2, l = i.height - c * 2, p = Math.min(d / h, l / a, 2);
    this.camera.zoom = p, this.camera.x = c - s * p, this.camera.y = c - o * p;
  }
  requestDraw() {
    this.animationId || (this.animationId = requestAnimationFrame(() => {
      this.animationId = null, this.draw();
    }));
  }
  draw() {
    var n, r, h;
    if (!this.ctx) return;
    const i = this.ctx, t = this.canvas.getBoundingClientRect(), e = t.width, s = t.height;
    i.setTransform(this.dpr, 0, 0, this.dpr, 0, 0), i.clearRect(0, 0, e, s), i.fillStyle = "#0a0a0a", i.fillRect(0, 0, e, s), i.save(), i.translate(this.camera.x, this.camera.y), i.scale(this.camera.zoom, this.camera.zoom);
    const o = g.hexSize;
    for (let a = 1; a <= g.gridW; a++)
      for (let c = 1; c <= g.gridH; c++) {
        const d = this.getHexCenter(a, c), l = d.x * this.camera.zoom + this.camera.x, p = d.y * this.camera.zoom + this.camera.y;
        if (l < -o * 2 || l > e + o * 2 || p < -o * 2 || p > s + o * 2) continue;
        const v = `${a}_${c}`, y = this.hexData[v], b = (y == null ? void 0 : y.type) || 10, M = ((n = this.terrainConfig[b]) == null ? void 0 : n.color) || this.defaultTerrainColors[b] || "#444", Y = this.terrainImages[b];
        this.drawHex(i, d.x, d.y, o, M, Y), ((r = this.selectedHex) == null ? void 0 : r.x) === a && ((h = this.selectedHex) == null ? void 0 : h.y) === c && this.drawHexHighlight(i, d.x, d.y, o);
      }
    this.drawHexIndicators(i, o), i.restore();
  }
  // Flat-top hex: vertices at angles 0°, 60°, 120°, 180°, 240°, 300°
  drawHex(i, t, e, s, o, n) {
    const r = 2 * Math.PI / 6, h = s * 1.02;
    i.beginPath();
    for (let a = 0; a < 6; a++) {
      const c = t + h * Math.cos(r * a), d = e + h * Math.sin(r * a);
      a === 0 ? i.moveTo(c, d) : i.lineTo(c, d);
    }
    if (i.closePath(), n) {
      i.save(), i.clip();
      const a = s * 2.1;
      i.drawImage(n, t - a / 2, e - a / 2, a, a), i.restore();
    } else
      i.fillStyle = o, i.fill();
    i.strokeStyle = "rgba(0, 0, 0, 0.3)", i.lineWidth = 1, i.stroke();
  }
  drawHexHighlight(i, t, e, s) {
    const o = 2 * Math.PI / 6, n = s * 1.02;
    i.beginPath();
    for (let r = 0; r < 6; r++) {
      const h = t + n * Math.cos(o * r), a = e + n * Math.sin(o * r);
      r === 0 ? i.moveTo(h, a) : i.lineTo(h, a);
    }
    i.closePath(), i.strokeStyle = "#ef233c", i.lineWidth = 3, i.stroke(), i.fillStyle = "rgba(239, 35, 60, 0.2)", i.fill();
  }
  drawMarker(i, t, e, s, o) {
    i.font = `${o}px sans-serif`, i.textAlign = "center", i.textBaseline = "middle", i.fillText(s, t, e);
  }
  drawHexIndicators(i, t) {
    const e = this.camera.zoom;
    let s;
    e >= 5 ? s = 7 : e >= 3 ? s = 6 : e >= 1.5 ? s = 3 : s = 1;
    const o = {};
    for (const n of this.locations)
      n.hexKey && (o[n.hexKey] || (o[n.hexKey] = []), o[n.hexKey].push({ kind: "location", type: n.type, name: n.name }));
    for (const n of this.features)
      n.hexKey && (o[n.hexKey] || (o[n.hexKey] = []), o[n.hexKey].push({ kind: "feature", type: n.type, name: n.name }));
    for (const [n, r] of Object.entries(o)) {
      const [h, a] = n.split("_").map(Number);
      if (!h || !a) continue;
      const c = this.getHexCenter(h, a), d = Math.min(r.length, s), l = r.slice(0, d);
      let p;
      l.length === 1 ? p = t * 1.6 * (e < 1 ? 1 : 0.8) : l.length <= 3 ? p = t * 0.7 : p = t * 0.5;
      const v = this.getIconPositions(c.x, c.y, l.length, t);
      for (let y = 0; y < l.length; y++) {
        const b = l[y], M = v[y], Y = b.kind === "location" ? `loc:${b.type}` : `feat:${b.type}`, st = this.iconImages[Y];
        if (i.save(), i.shadowColor = "rgba(0,0,0,0.6)", i.shadowBlur = 3, st)
          i.drawImage(st, M.x - p / 2, M.y - p / 2, p, p);
        else {
          const xt = b.kind === "location" ? "🏰" : "📍";
          i.font = `${p * 0.7}px sans-serif`, i.textAlign = "center", i.textBaseline = "middle", i.fillText(xt, M.x, M.y);
        }
        i.restore();
      }
    }
  }
  getIconPositions(i, t, e, s) {
    if (e === 1)
      return [{ x: i, y: t }];
    const o = [], n = 2 * Math.PI / 6, r = s * 0.55;
    for (let h = 0; h < e && h < 6; h++) {
      const a = n * h;
      o.push({
        x: i + r * Math.cos(a),
        y: t + r * Math.sin(a)
      });
    }
    return e >= 7 && o.push({ x: i, y: t }), o;
  }
  zoomIn() {
    this.camera.zoom = Math.min(5, this.camera.zoom * 1.2), this.requestDraw();
  }
  zoomOut() {
    this.camera.zoom = Math.max(0.3, this.camera.zoom / 1.2), this.requestDraw();
  }
  closePanel() {
    this.selectedHex = null, this.hexNotes = [], this.requestDraw();
  }
  getLocationsInHex(i) {
    return this.locations.filter((t) => t.hexKey === i);
  }
  getFeaturesInHex(i) {
    return this.features.filter((t) => t.hexKey === i);
  }
  getTerrainName(i) {
    var s;
    const t = this.hexData[i], e = (t == null ? void 0 : t.type) || 10;
    return ((s = this.terrainConfig[e]) == null ? void 0 : s.name) || `Terrain ${e}`;
  }
  render() {
    const i = this.selectedHex ? `${this.selectedHex.x}_${this.selectedHex.y}` : null, t = i ? this.getLocationsInHex(i) : [], e = i ? this.getFeaturesInHex(i) : [];
    return $`
      <div class="container">
        <div class="map-area">
          ${this.loading ? $`<div class="loading">Loading map...</div>` : ""}
          <canvas></canvas>
          
          <div class="controls">
            <button class="control-btn" @click=${this.zoomIn}>+</button>
            <button class="control-btn" @click=${this.zoomOut}>−</button>
          </div>

          <div class="zoom-indicator">${this.camera.zoom.toFixed(2)}×</div>

          ${this.selectedHex ? $`
            <div class="hex-info">
              Hex: <span class="coords">${this.selectedHex.x}, ${this.selectedHex.y}</span>
            </div>
          ` : ""}
        </div>

        ${this.selectedHex ? $`
          <div class="detail-panel">
            <div class="detail-header">
              <span class="detail-title">Hex ${this.selectedHex.x}, ${this.selectedHex.y}</span>
              <button class="close-btn" @click=${this.closePanel}>✕</button>
            </div>
            <div class="detail-content">
              <div class="terrain-badge">${this.getTerrainName(i)}</div>

              <!-- Locations -->
              <div class="section">
                <div class="section-title">🏰 Locations</div>
                ${t.length > 0 ? $`
                  <div class="item-list">
                    ${t.map((s) => $`
                      <div class="item">
                        <div class="item-name">${s.name}</div>
                        <div class="item-type">${s.type}</div>
                      </div>
                    `)}
                  </div>
                ` : $`<div class="empty-state">No locations</div>`}
              </div>

              <!-- Features -->
              <div class="section">
                <div class="section-title">📍 Points of Interest</div>
                ${e.length > 0 ? $`
                  <div class="item-list">
                    ${e.map((s) => $`
                      <div class="item">
                        <div class="item-name">${s.name}</div>
                        <div class="item-type">${s.type}</div>
                      </div>
                    `)}
                  </div>
                ` : $`<div class="empty-state">No features</div>`}
              </div>

              <!-- Notes -->
              <div class="section">
                <div class="section-title">📝 Notes (${this.hexNotes.length})</div>
                ${this.hexNotes.length > 0 ? $`
                  <div class="item-list">
                    ${this.hexNotes.map((s) => $`
                      <div class="item">
                        <div class="item-name">${s.authorName}</div>
                        <div class="item-type">${s.content.slice(0, 100)}${s.content.length > 100 ? "..." : ""}</div>
                      </div>
                    `)}
                  </div>
                ` : $`<div class="empty-state">No notes</div>`}
              </div>
            </div>
          </div>
        ` : ""}
      </div>
    `;
  }
};
m.styles = wt`
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

    .loading {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--wm-accent);
    }

    .zoom-indicator {
      position: absolute;
      bottom: 12px;
      left: 12px;
      background: rgba(0, 0, 0, 0.6);
      color: var(--wm-text-muted);
      font-size: 12px;
      font-family: monospace;
      padding: 4px 8px;
      border-radius: 6px;
      border: 1px solid var(--wm-border);
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

    .terrain-badge {
      display: inline-block;
      padding: 4px 8px;
      background: var(--wm-bg-secondary);
      border: 1px solid var(--wm-border);
      border-radius: 4px;
      font-size: 12px;
      margin-bottom: 12px;
    }
  `;
f([
  D({ type: String })
], m.prototype, "authToken", 2);
f([
  D({ type: String })
], m.prototype, "userId", 2);
f([
  D({ type: String })
], m.prototype, "userName", 2);
f([
  D({ type: Boolean })
], m.prototype, "isAdmin", 2);
f([
  D({ type: Boolean })
], m.prototype, "isDm", 2);
f([
  x()
], m.prototype, "selectedHex", 2);
f([
  x()
], m.prototype, "camera", 2);
f([
  x()
], m.prototype, "hexData", 2);
f([
  x()
], m.prototype, "locations", 2);
f([
  x()
], m.prototype, "features", 2);
f([
  x()
], m.prototype, "hexNotes", 2);
f([
  x()
], m.prototype, "loading", 2);
f([
  x()
], m.prototype, "terrainConfig", 2);
f([
  x()
], m.prototype, "markerTypesConfig", 2);
f([
  qt("canvas")
], m.prototype, "canvas", 2);
m = f([
  Vt("wm-map")
], m);
console.log("West Marches Web Components loaded");
export {
  m as WmMap,
  w as firestore
};
