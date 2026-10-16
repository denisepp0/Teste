/*
 * Protótipo HTML — Financeiro · PROAFE.
 *
 * Segue as telas do Figma (Protótipo final › PROAFE) e a EFS
 * docs/gerenciamento-de-escolas/cadastro-de-financeiro-proafe.md, de 13/10/2026.
 * Rotas: #/ (tab PROAFE) · #/repasse/novo · #/repasse/{id} · #/repasse/{id}/editar
 *        #/financeiro e #/financeiro/exercicios (aba Exercícios) · #/financeiro/repasses (aba Repasses)
 *        #/financeiro/abrir · #/financeiro/{ano}
 *
 * VERSÃO 2 (15/10/2026) — "exercício geral", com base no SIG-Escola. Montada na
 * conversa "Leitura de arquivo" (pasta SIG-escola) sobre a versão 1 de 14/10
 * (lista expansível, edição na linha, campo com Salvar e Cancelar na célula) e
 * trazida para o workspace com a regra da importação que faltava: a planilha é
 * recusada inteira se alguma escola já tiver previsão no exercício
 * (importacao-de-planilhas-do-financeiro.md, RN009; as linhas com erro são
 * recusadas e as corretas gravadas, RN008).
 *
 * Exercício geral: o exercício é aberto uma
 * vez para a rede, em Financeiro › Exercícios, com o Nº da portaria. O sistema
 * cria o repasse ordinário em cada escola pública, com o saldo anterior ligado,
 * e leva os repasses complementares com saldo diferente de zero. A previsão de
 * cada escola entra pela importação do Anexo I. Na tela da escola ficam só os
 * ajustes. A versão 1, escola a escola, continua em
 * insumos/financeiro/prototipo-html-proafe/, sem mudanças.
 *
 * Acessibilidade: rótulos em todos os campos, erro associado ao campo
 * (aria-describedby + aria-invalid), foco no primeiro erro (WCAG 3.3.1),
 * toasts em região aria-live (WCAG 4.1.3), modal nativo <dialog> (ARIA APG),
 * ordenação com aria-sort, valor negativo identificado por texto (WCAG 1.4.1).
 */
"use strict";

const CHAVE = "proafe-html-v2";
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

let dados;
const ui = {
  perfil: "smed",
  cenario: "completo",
  exSel: null,
  edit: null, // { escopo, campo, cat, erro, rascunho }
  portariaEdit: false,
  contaForm: null, // "editar" | "nova"
  contaErros: {},
  filtroTipo: "todos",
  exibirZerados: false,
  ordem: null, // { col, dir }
  pagina: 1,
  porPagina: 10,
  alertaCopia: null,
  abrirSel: null,
  abrirErros: {},
  formTipo: "",
  formErros: {},
  formValores: { saldoAnt: null, previsao: null, despesas: null },
  formValorEdit: null, // { campo, erro, rascunho }
  expandidos: [], // repasses complementares abertos na lista
  editandoDetalhe: null, // repasse em edição dentro da linha expandida
  focar: null,
  geralErros: {}, // tela Abrir exercício (rede)
  geralPortaria: "", // Nº da portaria digitado na tela Abrir exercício
  portariaGeralEdit: false,
  importacao: null, // { ano, etapa: 'escolher' | 'previa', arquivo, res, erro, filtro }
  escOrdem: null, // tabela de escolas do exercício: { pendDir, col, dir }; null = pendências primeiro, depois Escola A–Z
  soPendencias: false, // tabela de escolas do exercício: começa com todas as escolas
  // Financeiro › Repasses (lista geral): filtros aplicados no Filtrar
  rep: { tipo: "", ident: "", unidade: "", extintos: false, ordem: null, pagina: 1, porPagina: 10 },
  escBusca: "", // tela Escolas: Localizar escola
  // paginação (componente paginacao do DS) das tabelas da tela do exercício
  pag: { esc: { pagina: 1, porPagina: 10 }, anx: { pagina: 1, porPagina: 10 } },
};

function limparValoresForm() {
  ui.formValores = { saldoAnt: null, previsao: null, despesas: null };
  ui.formValorEdit = null;
}

/* ─── Persistência ────────────────────────────────────────────────────────── */

function carregar() {
  try {
    const s = JSON.parse(localStorage.getItem(CHAVE));
    if (s && s.dados) {
      dados = s.dados;
      ui.perfil = s.perfil || "smed";
      ui.cenario = s.cenario || "completo";
      return;
    }
  } catch (e) {
    /* começa do zero */
  }
  dados = estadoInicial("completo");
  abrirExercicioDeExemplo();
}

/* Exercício 2027 já aberto para a rede e sem a planilha importada, para o
   protótipo começar pronto para testar a importação. Mesmo efeito de "Abrir
   exercício": repasse ordinário sem previsão e complementares com saldo levados. */
function abrirExercicioDeExemplo() {
  const ano = "2027", ant = "2026";
  if (!dados.ordinario[ant] || dados.exercicios[ano]) return;
  dados.exercicios[ano] = { portaria: "32970114/2027", periodo: { ini: 1, fim: 12, prazo: "" }, abertoEm: "15/10/2026 às 09:00", por: "sandra.madalena", anexo: null };
  dados.ordinario[ano] = { previsao: null, despesas: { c: null, k: null }, atualizacao: null };
  dados.complementares.forEach((r) => {
    if (repNoAno(r, ant) && repSaldoTotal(r, ant) !== 0) {
      r.valores[ano] = { previsao: null, despesas: null };
      r.copiado = r.copiado || {};
      r.copiado[ano] = true;
    }
  });
  dados.rede.forEach((e) => { if (e.anos[ant]) e.anos[ano] = { previsao: null }; });
  // Escola que entrou no PROAFE em 2027: sem saldo de 2026 (pendência "Primeiro exercício").
  dados.rede.push({ id: "a" + ESCOLA_NOVA_2027.n, nome: ESCOLA_NOVA_2027.nome, conta: true, anos: { [ano]: { previsao: null } } });
  if (ui.cenario === "escola-nova-2027") cenarioEscolaNova(ano);
}

/* Cenário: a planilha de 2027 já foi importada para a rede e a EMEI JP
   Cirandinha foi cadastrada no SIE depois. Ela não tem exercícios anteriores e
   fica sem previsão em 2027: a previsão é informada na tela da escola (só neste
   caso e nas linhas com erro); ela só entra na planilha do exercício seguinte. */
function cenarioEscolaNova(ano) {
  const data = "20/10/2026 às 10:15";
  const planilha = new Map(linhasDaPlanilhaExemplo().map(([, nome, mensal]) => [nome, mensal]));
  dados.rede.forEach((e) => { if (e.anos[ano] && planilha.has(e.nome)) e.anos[ano].previsao = planilha.get(e.nome) * 12; });
  dados.exercicios[ano].anexo = { data, por: "ana.ribeiro", qtd: dados.rede.length, fora: [], arquivo: "Planilha_valores_PROAFE_2027.xlsx", problemas: 0 };
  dados.ordinario = { [ano]: { previsao: null, despesas: { c: null, k: null }, atualizacao: null } };
  dados.complementares = [];
  dados.historico = [];
}

/* Aberto como "data:" (painel de visualização) ou em janela isolada, o
   navegador bloqueia o localStorage: o protótipo segue funcionando, só sem
   guardar entre uma abertura e outra. */
function salvar() {
  try {
    localStorage.setItem(CHAVE, JSON.stringify({ dados, perfil: ui.perfil, cenario: ui.cenario }));
  } catch (e) {
    /* sem armazenamento: os dados ficam só na memória desta página */
  }
}

/* ─── Formatação ──────────────────────────────────────────────────────────── */

const LIMITE = 99999999999; // 999.999.999,99 em centavos

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
}

function fmt(cents) {
  if (cents == null) return "";
  const neg = cents < 0;
  const v = Math.abs(cents);
  const inteiro = String(Math.floor(v / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return (neg ? "−" : "") + inteiro + "," + String(v % 100).padStart(2, "0");
}

/* Negativo: sinal de menos e vermelho, e identificado por texto (RN019, WCAG 1.4.1). */
/* Célula sem valor: "—" só quando não se aplica; quando o valor deveria existir e
   ainda falta, o estado é escrito (GOV.UK Summary list; NN/g). */
const naoInformado = (txt = "Não informado") => `<span class="texto-auxiliar">${txt}</span>`;

function valorHtml(cents, vazio = "—") {
  if (cents == null) return vazio;
  if (cents < 0) return `<span class="valor-negativo">${fmt(cents)}<span class="visually-hidden"> (negativo)</span></span>`;
  return fmt(cents);
}

function parseValor(txt) {
  let t = String(txt || "").trim().replace(/^R\$\s*/, "").replace(/\s/g, "");
  if (!t) return { vazio: true };
  let neg = false;
  if (/^[-−]/.test(t)) {
    neg = true;
    t = t.slice(1);
  }
  if (!/^(\d{1,3}(\.\d{3})+|\d+)(,\d{1,2})?$/.test(t)) return { erro: true };
  const [i, d = "0"] = t.replace(/\./g, "").split(",");
  const v = parseInt(i, 10) * 100 + parseInt(d.padEnd(2, "0"), 10);
  if (v > LIMITE) return { erro: true };
  return { valor: neg ? -v : v };
}

function agora() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} às ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function registrar(acao, detalhe) {
  dados.historico.unshift({ data: agora().replace(" às", ""), usuario: "sandra.madalena", acao, detalhe });
}

const smed = () => ui.perfil === "smed";

/* ─── Regras de saldo (RN019, RN023, RN030) ───────────────────────────────── */

/* Exercício = um período de um ano (um período de prestação de contas). A chave
   é o ano ("2027") ou, para o segundo período do mesmo ano, "2027.2". O anterior
   de "2027.2" é "2027"; o rótulo mostra o período quando não é o ano inteiro:
   "2027 jul–dez". */
const anoDe = (k) => Math.floor(parseFloat(k));
const ordemEx = (a, b) => parseFloat(a) - parseFloat(b);
function chavesEx() {
  return [...new Set([...Object.keys(dados.exercicios || {}), ...Object.keys(dados.ordinario)])].sort(ordemEx);
}
function anterior(k) {
  const c = chavesEx();
  const i = c.indexOf(String(k));
  return i > 0 ? c[i - 1] : null;
}
function proximo(k) {
  const c = chavesEx();
  const i = c.indexOf(String(k));
  return i >= 0 && i < c.length - 1 ? c[i + 1] : null;
}
function rotuloEx(k) {
  if (k == null) return "";
  // O exercício é só o ano, sem período nem prazo (reunião de 15/10/2026).
  return String(anoDe(k));
}
const rotuloAnterior = (k) => (anterior(k) ? rotuloEx(anterior(k)) : String(anoDe(k) - 1));

function anos() {
  return Object.keys(dados.ordinario).sort((a, b) => ordemEx(b, a));
}
const maisRecente = () => anos()[0];
const primeiroAno = () => anos()[anos().length - 1];

function ordPrevisao(ano) {
  const p = dados.ordinario[ano].previsao;
  if (p == null) return { c: null, k: null, t: null };
  const pc = Math.round(p * 0.8);
  return { c: pc, k: p - pc, t: p };
}

function ordLigado(ano) {
  return ano !== primeiroAno() && !!dados.ordinario[anterior(ano)];
}

function ordSaldoAnt(ano) {
  if (ordLigado(ano)) return ordSaldoTotal(anterior(ano));
  const s = dados.ordinario[ano].saldoAnt || { c: 0, k: 0 };
  return { c: s.c || 0, k: s.k || 0 };
}

function ordSaldoTotal(ano) {
  const sa = ordSaldoAnt(ano);
  const pv = ordPrevisao(ano);
  const d = dados.ordinario[ano].despesas || {};
  return { c: sa.c + (pv.c || 0) - (d.c || 0), k: sa.k + (pv.k || 0) - (d.k || 0) };
}

const repNoAno = (r, ano) => !!r.valores[ano];
const repLigado = (r, ano) => !!(r.copiado && r.copiado[ano] && r.valores[anterior(ano)]);

function repSaldoAnt(r, ano) {
  return repLigado(r, ano) ? repSaldoTotal(r, anterior(ano)) : r.valores[ano].saldoAnt || 0;
}

function repSaldoTotal(r, ano) {
  const v = r.valores[ano];
  return repSaldoAnt(r, ano) + (v.previsao || 0) - (v.despesas || 0);
}

const programaDe = (r) => PROGRAMAS.find((p) => p.nome === r.item);
const extinto = (r) => r.tipo === "programa" && programaDe(r) && programaDe(r).situacao === "Extinto";

function ident(r) {
  if (r.tipo === "emenda" || r.tipo === "op") return r.numero;
  return r.item + (extinto(r) ? " (extinto)" : "");
}

/* ─── Toast e modal ───────────────────────────────────────────────────────── */

function toast(msg, link, tipo = "sucesso") {
  const el = document.createElement("div");
  el.className = `toast toast--${tipo}`;
  el.innerHTML = `<i class="fa-solid ${tipo === "sucesso" ? "fa-check" : "fa-circle-info"}" aria-hidden="true"></i>
    <p class="toast__texto">${esc(msg)}${link ? ` <a href="${link.href}">${esc(link.texto)}</a>` : ""}</p>
    <button type="button" class="toast__fechar" aria-label="Fechar mensagem"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>`;
  $("#toasts").append(el);
  // Some sozinho, mas pausa com o mouse em cima e tem botão de fechar (WCAG 2.2.1).
  let t = setTimeout(() => el.remove(), 9000);
  el.addEventListener("mouseenter", () => clearTimeout(t));
  el.addEventListener("mouseleave", () => (t = setTimeout(() => el.remove(), 4000)));
  el.querySelector(".toast__fechar").addEventListener("click", () => el.remove());
}

function confirmar({ titulo, texto, botao }, aoConfirmar) {
  const dlg = $("#modal");
  $("#modal-titulo").textContent = titulo;
  $("#modal-texto").textContent = texto;
  $("#modal-confirmar").textContent = botao;
  const origem = document.activeElement;
  dlg.returnValue = "";
  dlg.showModal();
  dlg.addEventListener(
    "close",
    () => {
      if (dlg.returnValue === "confirmar") aoConfirmar();
      else if (origem && document.contains(origem)) origem.focus();
    },
    { once: true }
  );
}

/* ─── Roteamento ──────────────────────────────────────────────────────────── */

/* Rotas internas. A tela atual fica em `rotaAtual`, e não só no endereço da
   página: dentro de uma janela isolada (artefato, iframe) um link "#/..."
   seria resolvido contra o endereço de fora e trocaria a página inteira. O
   endereço é atualizado quando o navegador deixa, para o voltar funcionar. */
let rotaAtual = /^#\//.test(location.hash) ? location.hash : "#/";

function navegar(rota) {
  rotaAtual = rota;
  try {
    if (location.hash !== rota) history.pushState(null, "", rota);
  } catch (e) {
    /* janela isolada: segue só com a rota interna */
  }
  aoMudarDeTela();
}

function partes() {
  return (rotaAtual.replace(/^#/, "") || "/").split("/").filter(Boolean);
}

function render(focarTitulo) {
  let ancora = null;
  if (!dados.ordinario[ui.exSel]) {
    const a = anos();
    ui.exSel = a.includes(String(ANO_CORRENTE)) ? String(ANO_CORRENTE) : a[0] || null;
  }
  const p = partes();
  const gestao = p[0] === "financeiro" && smed();
  const listaEscolas = p[0] === "escolas" && smed();
  document.body.classList.toggle("modo-gestao", gestao || listaEscolas);
  $$(".header__nav a").forEach((a) => a.removeAttribute("aria-current"));
  $(gestao ? "#nav-financeiro" : "#nav-escolas").setAttribute("aria-current", "page");
  // Telas internas do Financeiro (abrir, exercício, importar) não repetem o título
  // "Financeiro" nem as abas: são outra tela, com título próprio, seta de voltar e
  // o caminho completo na migalha.
  const subpagina = gestao && p[1] && p[1] !== "repasses" && p[1] !== "exercicios";
  const trilha = !gestao ? [["Escolas", "#/escolas"], ["Escola EMEI JP Cirandinha"]]
    : p[1] === "repasses" ? [["Financeiro", "#/financeiro/exercicios"], ["Repasses"]]
    : !subpagina ? [["Financeiro", "#/financeiro/exercicios"], ["Exercícios"]]
    : p[1] === "abrir" ? [["Financeiro", "#/financeiro/exercicios"], ["Exercícios", "#/financeiro/exercicios"], ["Abrir exercício"]]
    : p[2] === "importar" ? [["Financeiro", "#/financeiro/exercicios"], ["Exercícios", "#/financeiro/exercicios"], [`Exercício ${rotuloEx(p[1])}`, `#/financeiro/${p[1]}`], ["Importar planilha de valores"]]
    : [["Financeiro", "#/financeiro/exercicios"], ["Exercícios", "#/financeiro/exercicios"], [`Exercício ${rotuloEx(p[1])}`]];
  document.body.classList.toggle("gestao-interna", !!subpagina);
  $(".breadcrumb").innerHTML = trilha.map(([t, h], i) => i === trilha.length - 1 ? `<li><span aria-current="page">${esc(t)}</span></li>` : `<li><a href="${h}">${esc(t)}</a></li>`).join("");
  let html;
  if (listaEscolas) html = telaEscolas();
  else if (gestao) html = (subpagina ? "" : cabecalhoFinanceiro(p[1] === "repasses" ? "repasses" : "exercicios")) + (
    p[1] === "repasses" ? telaRepassesGerais()
    : p[1] === "abrir" ? telaAbrirGeral()
    : !p[1] || p[1] === "exercicios" ? telaExercicios()
    : p[2] === "importar" ? telaImportarAnexo(p[1])
    : telaExercicioGeral(p[1]));
  else if (p[0] === "repasse" && p[1] === "novo" && smed()) html = telaForm(null);
  else if (p[0] === "repasse" && p[2] === "editar" && smed()) html = telaForm(p[1]);
  else if (p[0] === "repasse" && p[1]) {
    // "Ver repasse" é um link âncora: volta à tab PROAFE com a linha do repasse
    // expandida, na página certa, e rola até ela (a tela de visualização saiu).
    ancora = prepararAncora(p[1]);
    html = telaProafe();
  } else html = telaProafe();
  $("#conteudo").innerHTML = html;
  $("#usuario-lotacao").textContent = smed() ? (gestao ? "SMED · Financeiro" : "SMED · Gestão Escola") : "EMEI JP Cirandinha";
  depoisDeRenderizar();
  if (ancora) {
    rotaAtual = "#/";
    try { history.replaceState(null, "", "#/"); } catch (e) { /* janela isolada */ }
    const linha = $(`tr.linha-expansivel[data-id="${ancora}"]`);
    if (linha) {
      linha.scrollIntoView({ block: "start" });
      window.scrollBy(0, -24);
      linha.querySelector('[data-acao="alternar-detalhe"]').focus({ preventScroll: true });
      return true;
    }
  }
  if (ui.focar) {
    const f = $(ui.focar);
    ui.focar = null;
    if (f) {
      f.focus();
      // Campo de texto que volta com erro: cursor no fim, para continuar digitando.
      if (f.tagName === "INPUT" && /^(text|search|)$/.test(f.type || "") && f.setSelectionRange) f.setSelectionRange(f.value.length, f.value.length);
    }
  } else if (focarTitulo) {
    const h = $("#conteudo h2");
    if (h) h.focus();
  }
  return false;
}

/* Deixa o repasse visível na lista: exercício em que ele existe, filtros que
   não o escondam, a página em que ele cai e a linha expandida. */
function prepararAncora(id) {
  const r = dados.complementares.find((x) => x.id === id);
  if (!r) return null;
  if (!repNoAno(r, ui.exSel)) ui.exSel = Object.keys(r.valores).sort(ordemEx).pop();
  if (ui.filtroTipo !== "todos" && ui.filtroTipo !== r.tipo) ui.filtroTipo = "todos";
  if (repSaldoTotal(r, ui.exSel) === 0) ui.exibirZerados = true;
  const idx = listaComplementares(ui.exSel).findIndex((x) => x.id === id);
  ui.pagina = Math.floor(Math.max(idx, 0) / ui.porPagina) + 1;
  if (!ui.expandidos.includes(id)) ui.expandidos = [...ui.expandidos, id];
  return id;
}

function depoisDeRenderizar() {
  const ed = $(".edicao-celula input");
  if (ed && !ui.focar) {
    ed.focus();
    ed.select();
  }
}

/* ─── Tab PROAFE (FLUXO001, FLUXO002, FLUXO009) ───────────────────────────── */

function telaProafe() {
  const temEx = anos().length > 0;
  return `
    <h2 class="conteudo__titulo" tabindex="-1">Financeiro</h2>
    <div class="tabs" role="tablist" aria-label="Origem do recurso">
      <button class="tab-item" role="tab" aria-selected="true" id="aba-proafe" aria-controls="painel-proafe">PROAFE</button>
      <button class="tab-item" role="tab" aria-selected="false" data-acao="fora" tabindex="-1">PDDE</button>
    </div>
    <div role="tabpanel" id="painel-proafe" aria-labelledby="aba-proafe">
      ${dados.conselho ? "" : alerta("warning", "Conselho Escolar não cadastrado", "É necessário cadastrar o Conselho Escolar para regularizar o repasse do PROAFE.")}
      ${blocoConta()}
      ${blocoExercicio()}
      ${temEx ? alertaExercicioAnterior() + blocoOrdinario(ui.exSel) + blocoComplementares(ui.exSel) : ""}
      ${blocoHistorico()}
    </div>`;
}

/* Comentário do protótipo: explicação para a equipe, escondida por padrão. Só
   aparece com "Mostrar comentários" ligado na barra do protótipo, para o cliente
   ver a tela como ela é. O texto pode ter HTML. */
function nota(texto) {
  return `<aside class="nota-prototipo" role="note" aria-label="Comentário do protótipo"><i class="fa-solid fa-comment-dots" aria-hidden="true"></i><p>${texto}</p></aside>`;
}

function alerta(tipo, titulo, corpo, extra = "") {
  const icone = { warning: "fa-triangle-exclamation", info: "fa-circle-info", danger: "fa-circle-exclamation" }[tipo];
  return `<div class="alert alert--${tipo}" role="${tipo === "info" ? "note" : "alert"}">
      <i class="fa-solid ${icone} alert__icone" aria-hidden="true"></i>
      <div><p class="alert__titulo">${esc(titulo)}</p><p class="alert__corpo">${esc(corpo)}</p>${extra}</div>
    </div>`;
}

/* Conta bancária (FLUXO003, RN002–RN004, VAL001, VAL004, VAL005) */
function blocoConta() {
  const conta = dados.conta;
  const inativa = conta && conta.situacao === "Inativa";
  let corpo = "";
  if (ui.contaForm && smed()) corpo = formConta();
  else if (conta) corpo = camposLeitura([
    ["Banco", conta.banco],
    ["Agência", conta.agencia],
    ["Conta", conta.conta],
    ["Situação", `<span class="tag ${inativa ? "tag--default" : "tag--success"}">${esc(conta.situacao)}</span>`, true],
  ]);
  else corpo = `<p class="vazio-texto">Não existe conta cadastrada.</p>${smed() ? `<button type="button" class="btn btn--secondary" data-acao="conta-nova"><i class="fa-solid fa-plus" aria-hidden="true"></i> Conta bancária</button>` : ""}`;

  const avisoInativa = inativa && !ui.contaForm
    ? alerta("warning", "Esta escola não possui conta ativa para repasse do PROAFE.", "Cadastre uma nova conta para regularizar o repasse.")
      + (smed() ? `<button type="button" class="btn btn--secondary bloco-acao" data-acao="conta-nova"><i class="fa-solid fa-plus" aria-hidden="true"></i> Cadastrar nova conta</button>` : "")
    : "";
  const anteriores = dados.contasAnteriores.length && !ui.contaForm
    ? `<p class="texto-auxiliar">Contas anteriores: ${dados.contasAnteriores.map((a) => esc(`${a.banco} · ${a.agencia} · ${a.conta} (inativa)`)).join("; ")}</p>`
    : "";
  return `
    <section class="secao" aria-labelledby="t-conta">
      <div class="secao__cabecalho">
        <h3 class="secao__titulo" id="t-conta">Conta Bancária</h3>
        ${smed() && conta && !ui.contaForm && !inativa ? `<button type="button" class="btn btn--tertiary" data-acao="conta-editar"><i class="fa-solid fa-pen-to-square" aria-hidden="true"></i> Editar</button>` : ""}
      </div>
      ${avisoInativa}
      ${corpo}
      ${ui.contaForm === "editar" ? nota("A conta só pode ser inativada com os saldos do repasse ordinário e dos complementares zerados no exercício mais recente (reunião de 15/10). Para ver a inativação liberada, use o cenário \"Saldos zerados\".") : ""}
      ${anteriores}
    </section>`;
}

function camposLeitura(pares) {
  return `<dl class="campos-leitura-grade">${pares
    .filter((p) => p[1] !== undefined && p[1] !== null && p[1] !== "")
    .map(([r, v, html]) => `<div><dt>${esc(r)}</dt><dd>${html ? v : esc(v)}</dd></div>`)
    .join("")}</dl>`;
}

/* Trava da inativação da conta (reunião de 15/10/2026): a conta só fica inativa
   com o saldo do repasse ordinário e o dos complementares zerados no exercício
   mais recente da escola. */
function saldosDaEscola() {
  const ano = maisRecente();
  if (!ano || !dados.ordinario[ano]) return { ano, ord: 0, comp: 0 };
  const o = ordSaldoTotal(ano);
  const comp = dados.complementares.filter((r) => repNoAno(r, ano)).reduce((s, r) => s + repSaldoTotal(r, ano), 0);
  return { ano, ord: o.c + o.k, comp };
}

function erroInativarConta() {
  const s = saldosDaEscola();
  if (!s.ord && !s.comp) return null;
  return "Para inativar a conta, o saldo dos repasses precisa estar zerado.";
}

function formConta() {
  const nova = ui.contaForm === "nova";
  const c = nova ? { banco: "001 - Banco do Brasil", agencia: "", conta: "", situacao: "Ativa" } : dados.conta;
  const e = ui.contaErros;
  return `
    <form id="form-conta" class="formulario formulario--3" novalidate>
      ${campoRadio("conta-banco", "Banco", [["001 - Banco do Brasil", "001 - Banco do Brasil"], ["041 - Banrisul", "041 - Banrisul"]], c.banco, true, e.banco)}
      ${campoTexto("conta-agencia", "Agência", c.agencia, true, e.agencia)}
      ${campoTexto("conta-conta", "Conta", c.conta, true, e.conta)}
      ${nova ? "" : campoRadio("conta-situacao", "Situação", [["Ativa", "Ativa"], ["Inativa", "Inativa"]], ui.contaSituacao || c.situacao, true, e.situacao)}
      <div class="campo-largo acoes-form">
        <button type="submit" class="btn btn--primary">Salvar</button>
        <button type="button" class="btn btn--tertiary" data-acao="conta-cancelar">Cancelar</button>
      </div>
    </form>`;
}

/* Exercício (RN014, RN016) */
/* Exercício geral: a escola não abre exercício. O "+ Novo exercício" sai daqui:
   a SMED abre o exercício uma vez para a rede, em Financeiro › Exercícios. */
function blocoExercicio() {
  const a = anos();
  if (!a.length) {
    return `<section class="secao secao--continua" aria-labelledby="t-ex"><h3 class="secao__titulo" id="t-ex">Exercício</h3>
      <p class="vazio-texto">${smed() ? "Nenhum exercício aberto. A SMED abre o exercício para todas as escolas públicas em Financeiro › Exercícios." : "A SMED ainda não abriu nenhum exercício do PROAFE."}</p></section>`;
  }
  return `
    <section class="secao secao--continua" aria-labelledby="t-ex">
      <h3 class="secao__titulo" id="t-ex">Exercício</h3>
      <div class="linha-acoes">
        <label class="visually-hidden" for="sel-ex">Exercício</label>
        <select id="sel-ex" class="controle seletor-exercicio">
          ${a.map((x) => `<option value="${x}" ${x === ui.exSel ? "selected" : ""}>${rotuloEx(x)}</option>`).join("")}
        </select>
      </div>
    </section>`;
}

/* Aviso do exercício anterior (RN030) */
function alertaExercicioAnterior() {
  if (ui.exSel === maisRecente()) return "";
  return alerta(
    "info",
    "Este não é o exercício mais recente",
    `Alterações nos saldos e nas despesas de ${rotuloEx(ui.exSel)} atualizam automaticamente o saldo anterior de ${rotuloEx(proximo(ui.exSel))}.`
  );
}

/* Repasse ordinário (FLUXO004, RN006, RN007, RN019–RN021) */
/* Exercício geral: a portaria é do exercício (uma para a rede) e aparece aqui só
   para leitura. A previsão vem do Anexo I e pode ser corrigida aqui. */
function blocoOrdinario(ano) {
  const o = dados.ordinario[ano];
  const ex = dados.exercicios[ano] || {};
  const portaria = `<span>${esc(ex.portaria || "—")}</span>`;
  const primeiro = !ordLigado(ano) && !o.saldoAnt && smed()
    ? alerta("info", `Primeiro exercício do PROAFE desta escola no SIE`, `Informe o saldo que a escola tinha ao fim de ${rotuloAnterior(ano)}, separado em custeio e capital, na linha "(+) Saldo de ${rotuloAnterior(ano)}". Use 0,00 quando não havia saldo.`)
    : "";
  const semPrevisao = o.previsao == null && smed()
    ? ex.anexo
      ? alerta("warning", "Previsão do repasse anual não informada", "Informe a previsão na coluna Total.") +
        nota("A escola não veio na planilha da portaria: foi cadastrada depois da importação ou a linha dela teve erro. Só nesses casos a previsão é informada na escola, e ela fica editável. A escola entra na planilha do exercício seguinte.")
      : alerta("info", "Previsão do repasse anual aguardando a planilha", `A previsão de ${rotuloEx(ano)} vem da planilha de valores da portaria.`) +
        nota("Antes da importação a previsão não é informada na escola: a importação recusaria a planilha por essa escola já ter previsão (RN009).")
    : "";
  return `
    <section class="secao" aria-labelledby="t-ord">
      <h3 class="secao__titulo secao__titulo--h5" id="t-ord">Repasse ordinário</h3>
      ${primeiro}${semPrevisao}
      <div class="campo-portaria"><span class="campo__rotulo" id="r-portaria">Nº da portaria</span><div class="campo-portaria__valor">${portaria}</div></div>
      ${tabelaOrdinario(ano)}
      ${informativos([
        o.origemPrevisao ? `Previsão importada da planilha de valores da portaria em ${esc(o.origemPrevisao)}.` : o.previsaoManual ? `Previsão informada na escola em ${esc(o.previsaoManual)}.` : null,
        o.atualizacao ? `Despesas atualizadas em ${esc(o.atualizacao)}.` : "Despesas ainda não informadas neste exercício.",
      ])}
      ${o.origemPrevisao ? nota("Previsão importada é só leitura (reunião de 15/10): o valor precisa bater com o da planilha. Mudança de valor só por uma atualização da planilha (proposta 2.11b do checklist).")
        : o.previsaoManual ? nota("Previsão manual: a escola não veio na planilha. Por isso fica editável.") : ""}
    </section>`;
}

/* Faixa de informativos abaixo de uma tabela: um ícone só e uma linha por informação. */
function informativos(linhas) {
  const l = linhas.filter(Boolean);
  return `<div class="atualizacao atualizacao--lista"><i class="fa-solid fa-circle-info" aria-hidden="true"></i><div>${l.map((t) => `<p>${t}</p>`).join("")}</div></div>`;
}

function botaoIcone(acao, icone, rotulo, dadosExtra = "") {
  const fa = { edit: "fa-pen-to-square", trash: "fa-trash" }[icone];
  return `<button type="button" class="btn-icone ${icone === "trash" ? "btn-icone--perigo" : ""}" data-acao="${acao}" ${dadosExtra} aria-label="${esc(rotulo)}"><i class="fa-solid ${fa}" aria-hidden="true"></i></button>`;
}

/* Campo aberto na célula — componente miniform do Figma (8178-226326): label
   "Valor *", campo na largura da célula com o "x" de limpar, a mensagem de erro
   embaixo e, na linha de baixo, Salvar e Cancelar à esquerda, como nos
   formulários (teste de 14/10). A célula cresce em altura; a largura das
   colunas não muda. */
function miniform({ tag, attrs, id, valor, erro, rotulo, botao, cancelar }) {
  return `<${tag} class="edicao-celula${erro ? " campo--erro" : ""}" ${attrs} ${tag === "form" ? "novalidate" : ""}>
      <label class="campo__rotulo" for="${id}">Valor<span class="visually-hidden"> — ${esc(rotulo)}</span><span class="obrigatorio" aria-hidden="true">*</span></label>
      <div class="edicao-celula__linha">
        <span class="edicao-celula__campo">
          <input id="${id}" class="controle controle--monetario" inputmode="decimal" placeholder=" " aria-required="true"
            value="${esc(valor)}" ${erro ? `aria-invalid="true" aria-describedby="${id}-erro"` : ""} />
          <button type="button" class="edicao-celula__limpar" data-acao="limpar-campo" aria-label="Limpar o valor"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>
        </span>
      </div>
      ${erro ? erroCampo(`${id}-erro`, erro) : ""}
      <div class="edicao-celula__acoes">${botao}${cancelar}</div>
    </${tag}>`;
}

/* Célula de valor: mostra, abre edição na própria célula, lixeira (FLUXO004, critérios 1, 3, 6) */
function celulaValor(escopo, campo, cat, valor, opcoes) {
  const { editavel, lixeira, rotulo } = opcoes;
  const editando = ui.edit && ui.edit.escopo === escopo && ui.edit.campo === campo && ui.edit.cat === cat;
  const dataAttr = `data-escopo="${escopo}" data-campo="${campo}" data-cat="${cat || ""}"`;
  if (editando) {
    const id = `ed-${campo}-${cat || "t"}`;
    const erro = ui.edit.erro;
    return miniform({
      tag: "form", attrs: dataAttr, id, erro, rotulo,
      valor: ui.edit.rascunho != null ? ui.edit.rascunho : fmt(valor),
      botao: `<button type="submit" class="btn btn--primary">Salvar</button>`,
      cancelar: `<button type="button" class="btn btn--tertiary" data-acao="cancelar-valor" ${dataAttr}>Cancelar</button>`,
    });
  }
  if (valor == null) {
    return editavel && smed()
      ? `<button type="button" class="btn btn--tertiary btn--compacto" data-acao="editar-valor" ${dataAttr} aria-label="Informar ${esc(rotulo)}"><i class="fa-solid fa-plus" aria-hidden="true"></i> Valor</button>`
      : naoInformado();
  }
  const acoes = smed()
    ? (editavel ? botaoIcone("editar-valor", "edit", `Editar ${rotulo}`, dataAttr) : "") +
      (lixeira ? botaoIcone("excluir-valor", "trash", `Excluir ${rotulo}`, dataAttr) : "")
    : "";
  return `<span class="celula-valor"><span>${valorHtml(valor)}</span>${acoes ? `<span class="celula-valor__acoes">${acoes}</span>` : ""}</span>`;
}

function erroCampo(id, msg) {
  return `<p class="campo__erro" id="${id}"><i class="fa-solid fa-circle-xmark" aria-hidden="true"></i> ${esc(msg)}</p>`;
}

function tabelaOrdinario(ano) {
  const o = dados.ordinario[ano];
  const sa = ordSaldoAnt(ano);
  const ligado = ordLigado(ano);
  const pv = ordPrevisao(ano);
  const d = o.despesas || {};
  const st = ordSaldoTotal(ano);
  const soma = (a, b) => (a == null && b == null ? null : (a || 0) + (b || 0));
  const linhaSaldo = `(+) Saldo de ${rotuloAnterior(ano)}`;
  // Primeiro exercício: o saldo anterior ainda não informado aparece como tal, não como 0,00.
  const sInf = o.saldoAnt || {};
  const saInf = ligado ? sa : { c: sInf.c != null ? sInf.c : null, k: sInf.k != null ? sInf.k : null };
  return `
    <div class="tabela-rolagem">
    <table class="tabela tabela--valores">
      <caption class="visually-hidden">Valores do repasse ordinário de ${rotuloEx(ano)}${ligado ? `. O saldo de ${rotuloAnterior(ano)} vem do exercício anterior e não é editável aqui.` : ""}</caption>
      <thead><tr><th scope="col">Valores</th><th scope="col">Custeio (R$)</th><th scope="col">Capital (R$)</th><th scope="col">Total (R$)</th></tr></thead>
      <tbody>
        <tr><th scope="row">${linhaSaldo}</th>
          <td>${celulaValor("ord", "saldoAnt", "c", saInf.c, { editavel: !ligado, rotulo: `${linhaSaldo} — Custeio` })}</td>
          <td>${celulaValor("ord", "saldoAnt", "k", saInf.k, { editavel: !ligado, rotulo: `${linhaSaldo} — Capital` })}</td>
          <td>${valorHtml(soma(saInf.c, saInf.k), naoInformado())}</td></tr>
        <tr><th scope="row">(+) Previsão do repasse anual</th>
          <td>${valorHtml(pv.c, naoInformado())}</td><td>${valorHtml(pv.k, naoInformado())}</td>
          <td>${celulaValor("ord", "previsao", "", pv.t, { editavel: !o.origemPrevisao && !!(dados.exercicios[ano] && dados.exercicios[ano].anexo), rotulo: "Previsão do repasse anual — Total" })}</td></tr>
        <tr><th scope="row">(−) Despesas</th>
          <td>${celulaValor("ord", "despesas", "c", d.c, { editavel: true, lixeira: true, rotulo: "Despesas — Custeio" })}</td>
          <td>${celulaValor("ord", "despesas", "k", d.k, { editavel: true, lixeira: true, rotulo: "Despesas — Capital" })}</td>
          <td>${valorHtml(soma(d.c, d.k), naoInformado())}</td></tr>
      </tbody>
      <tfoot><tr class="linha-total"><th scope="row">Saldo total em ${rotuloEx(ano)}</th>
        <td>${valorHtml(st.c)}</td><td>${valorHtml(st.k)}</td><td>${valorHtml(st.c + st.k)}</td></tr></tfoot>
    </table></div>`;
}

/* Repasses complementares (FLUXO002, critérios 7 a 12; RN023, RN024) */
function listaComplementares(ano) {
  let lista = dados.complementares.filter((r) => repNoAno(r, ano));
  if (ui.filtroTipo !== "todos") lista = lista.filter((r) => r.tipo === ui.filtroTipo);
  if (!ui.exibirZerados) lista = lista.filter((r) => repSaldoTotal(r, ano) !== 0);
  const cmpTxt = (a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base", numeric: true });
  const padrao = (a, b) => cmpTxt(TIPOS[a.tipo], TIPOS[b.tipo]) || cmpTxt(ident(a), ident(b));
  if (ui.ordem) {
    const { col, dir } = ui.ordem;
    const chave = {
      tipo: (r) => TIPOS[r.tipo],
      ident: (r) => ident(r),
      custeio: (r) => (r.categoria === "custeio" ? repSaldoTotal(r, ano) : -Infinity),
      capital: (r) => (r.categoria === "capital" ? repSaldoTotal(r, ano) : -Infinity),
    }[col];
    lista.sort((a, b) => {
      const x = chave(a), y = chave(b);
      const r = typeof x === "number" ? x - y : cmpTxt(x, y);
      return (dir === "asc" ? r : -r) || padrao(a, b);
    });
  } else {
    // Ordem padrão: zerados no topo quando exibidos; depois Tipo e Identificação (critérios 10 e 11).
    lista.sort((a, b) => {
      const za = repSaldoTotal(a, ano) === 0 ? 0 : 1;
      const zb = repSaldoTotal(b, ano) === 0 ? 0 : 1;
      return za - zb || padrao(a, b);
    });
  }
  return lista;
}

function blocoComplementares(ano) {
  const contaAtiva = dados.conta && dados.conta.situacao === "Ativa";
  const lista = listaComplementares(ano);
  const total = lista.length;
  const paginas = Math.max(1, Math.ceil(total / ui.porPagina));
  if (ui.pagina > paginas) ui.pagina = paginas;
  const ini = (ui.pagina - 1) * ui.porPagina;
  const pagina = lista.slice(ini, ini + ui.porPagina);
  const somaCat = (cat) => lista.filter((r) => r.categoria === cat).reduce((s, r) => s + repSaldoTotal(r, ano), 0);

  const aviso = ui.alertaCopia && ui.alertaCopia.ano === ano
    ? `<div class="alert alert--info alert--fechavel" role="note">
        <i class="fa-solid fa-circle-info alert__icone" aria-hidden="true"></i>
        <div><p class="alert__titulo">Repasses levados de ${rotuloEx(ui.alertaCopia.de)}</p>
        <p class="alert__corpo">Foram levados os repasses com saldo em ${rotuloEx(ui.alertaCopia.de)}${ui.alertaCopia.zerados ? `; ${ui.alertaCopia.zerados} zerado${ui.alertaCopia.zerados > 1 ? "s ficaram" : " ficou"} em ${rotuloEx(ui.alertaCopia.de)}` : ""}.</p></div>
        <button type="button" class="alert__fechar" data-acao="fechar-aviso-copia" aria-label="Fechar aviso"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>
      </div>`
    : "";

  const th = (col, rotulo) => {
    const ativo = ui.ordem && ui.ordem.col === col;
    const padraoTipo = !ui.ordem && col === "tipo";
    const sort = ativo ? (ui.ordem.dir === "asc" ? "ascending" : "descending") : padraoTipo ? "ascending" : "none";
    const icone = sort === "ascending" ? "fa-sort-up" : sort === "descending" ? "fa-sort-down" : "fa-sort";
    return `<th scope="col" aria-sort="${sort}"><button type="button" class="th-ordenavel" data-acao="ordenar" data-col="${col}">${rotulo} <i class="fa-solid ${icone}" aria-hidden="true"></i></button></th>`;
  };

  const linhas = pagina.length
    ? pagina.map((r) => {
        const st = repSaldoTotal(r, ano);
        const aberto = ui.expandidos.includes(r.id);
        const linha = `<tr class="linha-expansivel${aberto ? " aberta" : ""}" data-id="${r.id}">
          <td>${esc(TIPOS[r.tipo])}</td>
          <td>${esc(ident(r))}</td>
          <td>${r.categoria === "custeio" ? valorHtml(st) : "—"}</td>
          <td>${r.categoria === "capital" ? valorHtml(st) : "—"}</td>
          <td class="col-expandir"><button type="button" class="btn btn--tertiary btn--circle" data-acao="alternar-detalhe" data-id="${r.id}"
            aria-expanded="${aberto}" aria-controls="det-${r.id}" aria-label="${aberto ? "Recolher" : "Expandir"} ${esc(TIPOS[r.tipo])} ${esc(ident(r))}">
            <i class="fa-solid fa-angle-${aberto ? "up" : "down"}" aria-hidden="true"></i></button></td></tr>`;
        return aberto ? linha + `<tr class="linha-detalhe" id="det-${r.id}"><td colspan="5">${detalheRepasse(r, ano)}</td></tr>` : linha;
      }).join("")
    : `<tr class="tabela__vazio"><td colspan="5">Nenhum repasse complementar ${ui.filtroTipo !== "todos" || !ui.exibirZerados ? "com esses filtros" : "neste exercício"}.</td></tr>`;

  return `
    <section class="secao" aria-labelledby="t-comp">
      <h3 class="secao__titulo secao__titulo--h5" id="t-comp">Repasses complementares</h3>
      ${aviso}
      ${nota("Na abertura do exercício, vêm todos os repasses complementares que não estão zerados, com o saldo do ano anterior. Não há tela de ajuste (reunião de 15/10): se precisar de um zerado, a SMED cadastra de novo.")}
      ${smed() ? `<div class="bloco-acao">
          <a class="btn btn--secondary" ${contaAtiva ? 'href="#/repasse/novo"' : 'aria-disabled="true" role="link" aria-describedby="ajuda-sem-conta"'}><i class="fa-solid fa-plus" aria-hidden="true"></i> Repasse complementar</a>
          ${contaAtiva ? "" : `<p class="campo__ajuda" id="ajuda-sem-conta">Para incluir um repasse complementar, a escola precisa ter uma conta ativa.</p>`}
        </div>` : ""}
      <div class="filtros">
        <div class="campo"><label class="campo__rotulo" for="filtro-tipo">Tipo de repasse</label>
          <select id="filtro-tipo" class="controle filtro-tipo">
            <option value="todos" ${ui.filtroTipo === "todos" ? "selected" : ""}>Todos</option>
            ${Object.entries(TIPOS).map(([k, v]) => `<option value="${k}" ${ui.filtroTipo === k ? "selected" : ""}>${v}</option>`).join("")}
          </select></div>
        <label class="checkbox"><input type="checkbox" id="filtro-zerados" ${ui.exibirZerados ? "checked" : ""} /> Exibir repasses zerados</label>
      </div>
      <div class="faixa-total" role="group" aria-label="Saldo total em ${rotuloEx(ano)}">
        <span class="faixa-total__rotulo">Saldo total em ${rotuloEx(ano)}</span>
        <span>Custeio: ${valorHtml(somaCat("custeio"))}</span>
        <span>Capital: ${valorHtml(somaCat("capital"))}</span>
      </div>
      <div class="tabela-rolagem">
      <table class="tabela tabela--lista">
        <caption class="visually-hidden">Repasses complementares de ${rotuloEx(ano)}. Expanda um repasse para ver os detalhes.</caption>
        <thead><tr>${th("tipo", "Tipo de repasse")}${th("ident", "Identificação")}${th("custeio", "Saldo de custeio (R$)")}${th("capital", "Saldo de capital (R$)")}<th scope="col" class="col-expandir"><span class="visually-hidden">Detalhes</span></th></tr></thead>
        <tbody>${linhas}</tbody>
      </table></div>
      ${paginacao(total, paginas, ini, pagina.length)}
    </section>`;
}

function paginacao(total, paginas, ini, qtd) {
  return `<nav class="paginacao" aria-label="Paginação da lista de repasses complementares">
      <div class="paginacao__grupo">
        <label for="por-pagina">Exibir</label>
        <select id="por-pagina">${[10, 20, 50].map((n) => `<option ${n === ui.porPagina ? "selected" : ""}>${n}</option>`).join("")}</select>
        <span class="paginacao__divisor" aria-hidden="true"></span>
        <span aria-live="polite">${total ? `${ini + 1}-${ini + qtd} de ${total} itens` : "0 itens"}</span>
      </div>
      <div class="paginacao__grupo">
        <label for="pagina">Página</label>
        <select id="pagina">${Array.from({ length: paginas }, (_, i) => `<option ${i + 1 === ui.pagina ? "selected" : ""}>${i + 1}</option>`).join("")}</select>
        <button type="button" class="btn btn--tertiary btn--circle" data-acao="pagina-anterior" aria-label="Página anterior" ${ui.pagina <= 1 ? "disabled" : ""}><i class="fa-solid fa-chevron-left" aria-hidden="true"></i></button>
        <button type="button" class="btn btn--tertiary btn--circle" data-acao="pagina-seguinte" aria-label="Próxima página" ${ui.pagina >= paginas ? "disabled" : ""}><i class="fa-solid fa-chevron-right" aria-hidden="true"></i></button>
      </div>
    </nav>`;
}

/* Histórico de alterações (FLUXO006) */
function blocoHistorico() {
  if (!smed()) return "";
  return `<details class="historico">
      <summary>Histórico de alterações <i class="fa-solid fa-chevron-down" aria-hidden="true"></i></summary>
      ${dados.historico.length ? `<div class="tabela-rolagem"><table class="tabela">
        <caption class="visually-hidden">Histórico de alterações do PROAFE</caption>
        <thead><tr><th scope="col">Data</th><th scope="col">Usuário</th><th scope="col">Ação</th><th scope="col">Detalhe</th></tr></thead>
        <tbody>${dados.historico.map((h) => `<tr><td>${esc(h.data)}</td><td>${esc(h.usuario)}</td><td>${esc(h.acao)}</td><td>${esc(h.detalhe)}</td></tr>`).join("")}</tbody>
      </table></div>` : `<p class="vazio-texto">Nenhuma alteração registrada.</p>`}
    </details>`;
}

/* Paginação do DS para as tabelas da tela do exercício: "esc" (escolas) e
   "anx" (prévia do Anexo I). Devolve a fatia da página e o HTML do componente. */
function paginar(chave, lista, rotulo) {
  const s = ui.pag[chave];
  const total = lista.length;
  const paginas = Math.max(1, Math.ceil(total / s.porPagina));
  if (s.pagina > paginas) s.pagina = paginas;
  const ini = (s.pagina - 1) * s.porPagina;
  const fatia = lista.slice(ini, ini + s.porPagina);
  const html = !total ? "" : `<nav class="paginacao" aria-label="Paginação da ${rotulo}">
      <div class="paginacao__grupo">
        <label for="${chave}-por-pagina">Exibir</label>
        <select id="${chave}-por-pagina" data-pag="${chave}" data-campo="porPagina">${[10, 20, 50].map((n) => `<option ${n === s.porPagina ? "selected" : ""}>${n}</option>`).join("")}</select>
        <span class="paginacao__divisor" aria-hidden="true"></span>
        <span aria-live="polite">${ini + 1}-${ini + fatia.length} de ${total} itens</span>
      </div>
      <div class="paginacao__grupo">
        <label for="${chave}-pagina">Página</label>
        <select id="${chave}-pagina" data-pag="${chave}" data-campo="pagina">${Array.from({ length: paginas }, (_, i) => `<option ${i + 1 === s.pagina ? "selected" : ""}>${i + 1}</option>`).join("")}</select>
        <button type="button" class="btn btn--tertiary btn--circle" data-pag="${chave}" data-passo="-1" aria-label="Página anterior" ${s.pagina <= 1 ? "disabled" : ""}><i class="fa-solid fa-chevron-left" aria-hidden="true"></i></button>
        <button type="button" class="btn btn--tertiary btn--circle" data-pag="${chave}" data-passo="1" aria-label="Próxima página" ${s.pagina >= paginas ? "disabled" : ""}><i class="fa-solid fa-chevron-right" aria-hidden="true"></i></button>
      </div>
    </nav>`;
  return { fatia, html };
}

document.addEventListener("click", (ev) => {
  const b = ev.target.closest("button[data-pag][data-passo]");
  if (!b) return;
  const s = ui.pag[b.dataset.pag];
  s.pagina += Number(b.dataset.passo);
  ui.focar = `button[data-pag="${b.dataset.pag}"][data-passo="${b.dataset.passo}"]`;
  render();
});

document.addEventListener("change", (ev) => {
  const t = ev.target;
  if (!t.dataset || !t.dataset.pag) return;
  const s = ui.pag[t.dataset.pag];
  s[t.dataset.campo] = Number(t.value);
  if (t.dataset.campo === "porPagina") s.pagina = 1;
  ui.focar = "#" + t.id;
  render();
});

/* ─── Escolas (Figma 46-3513) ────────────────────────────────────────────────
   O menu Escolas abre a lista de escolas. Só a EMEI JP Cirandinha, na primeira
   linha, abre (a linha inteira é clicável); os filtros e a paginação são da
   tela e não fazem parte deste protótipo, mas "Localizar escola" filtra a lista. */
const TAG_SITUACAO = { "Em atividade": "tag--success", Extinta: "tag--default", Paralisada: "tag--warning" };
const TAG_CME = { Vigente: "tag--primary-light", "Não credenciada": "tag--warning-light", "Em atraso": "tag--danger-light" };
const TAG_DOC = { Regularizada: "tag--primary", Vencida: "tag--danger", Pendente: "tag--warning" };

function telaEscolas() {
  const busca = normNome(ui.escBusca);
  const lista = ESCOLAS_LISTA.filter((e) => !busca || [e.nome, e.cnpj, e.inep, e.escola, e.estab].some((v) => v && normNome(v).includes(busca)));
  const th = (rot, ordenada) => `<th scope="col" ${ordenada ? 'aria-sort="ascending"' : ""}><span class="th-ordenavel">${rot} <i class="fa-solid ${ordenada ? "fa-sort-up" : "fa-sort"}" aria-hidden="true"></i></span></th>`;
  const linhas = lista.map((e) => {
    const abre = !!e.id;
    const nome = abre ? `<a class="lista-escolas__nome" href="#/">${esc(e.nome)}</a>` : `<span class="lista-escolas__nome">${esc(e.nome)}</span>`;
    const ids = e.rascunho ? "" : `<span class="celula-secundaria">CNPJ ${esc(e.cnpj)} | ${e.inep ? `INEP ${esc(e.inep)}` : `<span class="tag tag--warning-light">INEP pendente</span>`}</span>
        <span class="celula-secundaria">Escola ${esc(e.escola)} | Estabelecimento ${esc(e.estab)}</span>`;
    return `<tr${abre ? ' class="linha-clicavel" data-href="#/"' : ""}>
      <td>${e.situacao ? `<span class="tag ${TAG_SITUACAO[e.situacao]}">${esc(e.situacao)}</span>` : "—"}</td>
      <td>${e.rascunho ? `<span class="tag tag--highlight">Rascunho</span><br>` : ""}${nome}${ids}
        ${e.nivel.map((n) => `<span class="celula-secundaria">${esc(n)}</span>`).join("")}
        ${e.mantenedora ? `<span class="celula-secundaria lista-escolas__mantenedora">${esc(MANTENEDORA)}</span>` : ""}</td>
      <td>${esc(e.dep)}<span class="celula-secundaria">${esc(e.vinculo)}</span></td>
      <td>${e.bairro ? `${esc(e.bairro)}<span class="celula-secundaria">${esc(e.op)}</span><span class="celula-secundaria">${esc(e.ct)}</span>` : "—"}</td>
      <td>${e.cadastro || "—"}</td>
      <td>${e.cme ? `<span class="tag ${TAG_CME[e.cme]}">${esc(e.cme)}</span>` : "—"}</td>
      <td>${e.doc ? e.doc.map(([d, n]) => `<span class="tag ${TAG_DOC[d]}">${esc(d)}${n ? ` <span class="tag__contador">${n}</span>` : ""}</span>`).join("<br>") : "—"}</td>
    </tr>`;
  }).join("");
  const sel = (id, rot) => `<div class="campo"><label class="campo__rotulo" for="${id}">${rot}</label><select id="${id}" class="controle"><option>Selecione</option></select></div>`;
  return `
    <div class="escolas__cabecalho">
      <h1 class="page-title" tabindex="-1">Escolas</h1>
      <a class="btn btn--secondary" href="#/" data-acao="fora"><i class="fa-solid fa-plus" aria-hidden="true"></i> Nova escola</a>
    </div>
    <form id="form-busca-escolas" class="busca-escolas" role="search" aria-label="Localizar escola" novalidate>
      <div class="campo"><label class="campo__rotulo" for="esc-busca">Localizar escola</label>
        <input id="esc-busca" class="controle" value="${esc(ui.escBusca)}" placeholder="Nome/ CNPJ/ INEP/ código da escola/ código do estabelecimento" autocomplete="off" /></div>
      <div class="busca-escolas__filtros">
        ${sel("esc-dep", "Dependência administrativa")}
        ${sel("esc-vinculo", "Vínculo com a SMED")}
        ${sel("esc-nivel", "Nível de ensino")}
        <div class="filtros__acoes">
          <a class="btn btn--tertiary" href="#/" data-acao="fora"><i class="fa-solid fa-chevron-down" aria-hidden="true"></i> Filtros</a>
          <button type="submit" class="btn btn--primary"><i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i> Buscar</button>
        </div>
      </div>
    </form>
    <div class="tabela-rolagem">
    <table class="tabela lista-escolas">
      <caption class="visually-hidden">Escolas. A EMEI JP Cirandinha abre o cadastro da escola.</caption>
      <thead><tr>${th("Situação")}${th("Escola | Nível de ensino", true)}${th("Dep. adm | Vínculo")}${th("Bairro | O.P | C.T")}${th("Cadastro")}${th("Creden. CME")}${th("Documentação")}</tr></thead>
      <tbody>${linhas || `<tr class="tabela__vazio"><td colspan="7">Nenhuma escola encontrada.</td></tr>`}</tbody>
    </table></div>
    <nav class="paginacao" aria-label="Paginação da lista de escolas">
      <div class="paginacao__grupo">
        <label for="esc-por-pagina">Exibir</label>
        <select id="esc-por-pagina"><option>10</option></select>
        <span class="paginacao__divisor" aria-hidden="true"></span>
        <span>${busca ? `${lista.length} ${lista.length === 1 ? "item" : "itens"}` : "1-10 de 100 itens"}</span>
      </div>
      <div class="paginacao__grupo">
        <label for="esc-pagina">Página</label>
        <select id="esc-pagina"><option>1</option></select>
        <button type="button" class="btn btn--tertiary btn--circle" aria-label="Página anterior" disabled><i class="fa-solid fa-chevron-left" aria-hidden="true"></i></button>
        <button type="button" class="btn btn--tertiary btn--circle" data-acao="fora" aria-label="Próxima página"><i class="fa-solid fa-chevron-right" aria-hidden="true"></i></button>
      </div>
    </nav>`;
}

/* ─── Financeiro: título e abas (Figma 8732-70231) ─────────────────────────
   O menu Financeiro do cabeçalho abre a tela Financeiro, com duas abas:
   Exercícios (os exercícios do PROAFE abertos para a rede, a primeira) e
   Repasses (a lista geral das Tabelas do Financeiro). As abas são links, porque cada
   uma é uma página com endereço próprio (ARIA APG: tabs só para painéis na
   mesma página). */
function cabecalhoFinanceiro(aba) {
  const item = (id, rotulo, href) =>
    `<li><a class="tab-item" href="${href}" ${aba === id ? 'aria-current="page"' : ""}>${rotulo}</a></li>`;
  return `
    <h1 class="page-title financeiro__titulo">Financeiro</h1>
    <nav aria-label="Financeiro"><ul class="tabs tabs--pagina">
      ${item("exercicios", "Exercícios", "#/financeiro/exercicios")}
      ${item("repasses", "Repasses", "#/financeiro/repasses")}
    </ul></nav>`;
}

/* ─── Financeiro › Repasses (cadastro-de-tabelas-do-financeiro.md, FLUXO003) ─
   Lista geral dos repasses: ações do PDDE, programas e recursos extraordinários
   do PROAFE. Ordem padrão: Origem do recurso e depois Tipo de repasse, os dois
   em ordem crescente (critério 7). Extintos só com "Exibir repasses extintos".
   Os filtros valem ao clicar em Filtrar (ou Enter no campo). */
const SIGLA = (u) => String(u || "").split(" — ")[0];

function repassesGerais() {
  const lista = [
    { situacao: "Vigente", origem: "PDDE - Equidade", tipo: "Ação", ident: "Sala de Recursos", unidade: "UPE" },
    { situacao: "Vigente", origem: "PDDE - Qualidade", tipo: "Ação", ident: "CL – Cantinho da Leitura", unidade: "UPE" },
  ];
  PROGRAMAS.forEach((p) => lista.push({ situacao: p.situacao, origem: "PROAFE", tipo: "Programa", ident: p.nome, unidade: SIGLA(p.unidade) }));
  RECURSOS.forEach((n) => lista.push({ situacao: null, origem: "PROAFE", tipo: "Recurso extraordinário", ident: n, unidade: "UPE" }));
  return lista;
}

const COLS_REP = [
  ["situacao", "Situação"],
  ["origem", "Origem do recurso"],
  ["tipo", "Tipo de repasse"],
  ["ident", "Identificação"],
  ["unidade", "Unidade"],
];

function listaRepassesGerais() {
  const f = ui.rep;
  const cmp = (a, b) => String(a || "").localeCompare(String(b || ""), "pt-BR", { numeric: true });
  const busca = normNome(f.ident);
  const lista = repassesGerais().filter((r) =>
    (f.extintos || r.situacao !== "Extinto") &&
    (!f.tipo || r.tipo === f.tipo) &&
    (!f.unidade || r.unidade === f.unidade) &&
    (!busca || normNome(r.ident).includes(busca)));
  const padrao = (x, y) => cmp(x.origem, y.origem) || cmp(x.tipo, y.tipo) || cmp(x.ident, y.ident);
  if (!f.ordem) return lista.sort(padrao);
  const s = f.ordem.dir === "asc" ? 1 : -1;
  return lista.sort((x, y) => s * cmp(x[f.ordem.col], y[f.ordem.col]) || padrao(x, y));
}

function telaRepassesGerais() {
  const f = ui.rep;
  const todos = repassesGerais();
  const tipos = [...new Set(todos.map((r) => r.tipo))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const unidades = [...new Set(todos.map((r) => r.unidade))].sort();
  const lista = listaRepassesGerais();
  const total = lista.length;
  const paginas = Math.max(1, Math.ceil(total / f.porPagina));
  if (f.pagina > paginas) f.pagina = paginas;
  const ini = (f.pagina - 1) * f.porPagina;
  const pagina = lista.slice(ini, ini + f.porPagina);
  const th = (col, rotulo) => {
    const ativo = f.ordem && f.ordem.col === col;
    const sort = ativo ? (f.ordem.dir === "asc" ? "ascending" : "descending") : !f.ordem && col === "origem" ? "ascending" : "none";
    const icone = sort === "ascending" ? "fa-sort-up" : sort === "descending" ? "fa-sort-down" : "fa-sort";
    return `<th scope="col" aria-sort="${sort}"><button type="button" class="th-ordenavel" data-acao="rep-ordenar" data-col="${col}">${rotulo} <i class="fa-solid ${icone}" aria-hidden="true"></i></button></th>`;
  };
  const tag = (s) => s === "Vigente" ? `<span class="tag tag--primary">Vigente</span>` : s === "Extinto" ? `<span class="tag tag--default">Extinto</span>` : `<span aria-label="Sem situação">—</span>`;
  const filtrado = f.tipo || f.ident || f.unidade;
  const linhas = pagina.length
    ? pagina.map((r) => `<tr${r.situacao === "Extinto" ? ' class="linha-extinta"' : ""}>
        <td>${tag(r.situacao)}</td><td>${esc(r.origem)}</td><td>${esc(r.tipo)}</td><td>${esc(r.ident)}</td><td>${esc(r.unidade)}</td></tr>`).join("")
    : `<tr class="tabela__vazio"><td colspan="5">Nenhum repasse ${filtrado ? "com esses filtros" : "cadastrado"}.</td></tr>`;
  return `
    <section class="secao" aria-labelledby="t-rep">
      <div class="secao__cabecalho">
        <h2 class="secao__titulo secao__titulo--pagina" id="t-rep" tabindex="-1">Repasses</h2>
        <a class="btn btn--secondary" href="#/" data-acao="fora"><i class="fa-solid fa-plus" aria-hidden="true"></i> Repasse</a>
      </div>
      <form id="form-filtro-rep" class="filtros filtros--rep" novalidate role="search" aria-label="Filtrar repasses">
        <div class="campo"><label class="campo__rotulo" for="rep-tipo">Tipo de repasse</label>
          <select id="rep-tipo" class="controle"><option value="">Selecione</option>
            ${tipos.map((x) => `<option ${f.tipo === x ? "selected" : ""}>${esc(x)}</option>`).join("")}</select></div>
        <div class="campo"><label class="campo__rotulo" for="rep-ident">Identificação</label>
          <input id="rep-ident" class="controle" value="${esc(f.ident)}" autocomplete="off" /></div>
        <div class="campo"><label class="campo__rotulo" for="rep-unidade">Unidade</label>
          <select id="rep-unidade" class="controle"><option value="">Selecione</option>
            ${unidades.map((x) => `<option ${f.unidade === x ? "selected" : ""}>${esc(x)}</option>`).join("")}</select></div>
        <div class="filtros__acoes">
          <button type="submit" class="btn btn--primary"><i class="fa-solid fa-filter" aria-hidden="true"></i> Filtrar</button>
          <button type="button" class="btn btn--tertiary" data-acao="rep-limpar">Limpar filtros</button>
        </div>
      </form>
      <label class="checkbox filtros__extintos"><input type="checkbox" id="rep-extintos" ${f.extintos ? "checked" : ""} /> Exibir repasses extintos</label>
      <div class="tabela-rolagem">
      <table class="tabela tabela--rep">
        <caption class="visually-hidden">Repasses: ações do PDDE, programas e recursos extraordinários do PROAFE${filtrado ? ", filtrados" : ""}</caption>
        <thead><tr>${COLS_REP.map(([c, r]) => th(c, r)).join("")}</tr></thead>
        <tbody>${linhas}</tbody>
      </table></div>
      <nav class="paginacao" aria-label="Paginação da lista de repasses">
        <div class="paginacao__grupo">
          <label for="rep-por-pagina">Exibir</label>
          <select id="rep-por-pagina">${[10, 20, 50].map((n) => `<option ${n === f.porPagina ? "selected" : ""}>${n}</option>`).join("")}</select>
          <span class="paginacao__divisor" aria-hidden="true"></span>
          <span aria-live="polite">${total ? `${ini + 1}-${ini + pagina.length} de ${total} itens` : "0 itens"}</span>
        </div>
        <div class="paginacao__grupo">
          <label for="rep-pagina">Página</label>
          <select id="rep-pagina">${Array.from({ length: paginas }, (_, i) => `<option ${i + 1 === f.pagina ? "selected" : ""}>${i + 1}</option>`).join("")}</select>
          <button type="button" class="btn btn--tertiary btn--circle" data-acao="rep-anterior" aria-label="Página anterior" ${f.pagina <= 1 ? "disabled" : ""}><i class="fa-solid fa-chevron-left" aria-hidden="true"></i></button>
          <button type="button" class="btn btn--tertiary btn--circle" data-acao="rep-seguinte" aria-label="Próxima página" ${f.pagina >= paginas ? "disabled" : ""}><i class="fa-solid fa-chevron-right" aria-hidden="true"></i></button>
        </div>
      </nav>
    </section>`;
}

function filtrarRep() {
  ui.rep.tipo = $("#rep-tipo").value;
  ui.rep.ident = $("#rep-ident").value.trim();
  ui.rep.unidade = $("#rep-unidade").value;
  ui.rep.pagina = 1;
  ui.focar = "#t-rep";
  render();
}

document.addEventListener("click", (ev) => {
  const alvo = ev.target.closest('[data-acao^="rep-"]');
  if (!alvo) return;
  const f = ui.rep;
  switch (alvo.dataset.acao) {
    case "rep-ordenar": {
      const col = alvo.dataset.col;
      f.ordem = f.ordem && f.ordem.col === col ? (f.ordem.dir === "asc" ? { col, dir: "desc" } : null) : { col, dir: "asc" };
      f.pagina = 1;
      ui.focar = `[data-acao="rep-ordenar"][data-col="${col}"]`;
      break;
    }
    case "rep-limpar":
      Object.assign(f, { tipo: "", ident: "", unidade: "", pagina: 1 });
      ui.focar = "#rep-tipo";
      break;
    case "rep-anterior": f.pagina--; ui.focar = '[data-acao="rep-anterior"]'; break;
    case "rep-seguinte": f.pagina++; ui.focar = '[data-acao="rep-seguinte"]'; break;
    default: return;
  }
  render();
});

document.addEventListener("change", (ev) => {
  const t = ev.target;
  const f = ui.rep;
  if (t.id === "rep-extintos") { f.extintos = t.checked; f.pagina = 1; }
  else if (t.id === "rep-por-pagina") { f.porPagina = Number(t.value); f.pagina = 1; }
  else if (t.id === "rep-pagina") f.pagina = Number(t.value);
  else return;
  ui.focar = "#" + t.id;
  render();
});

/* ─── Exercício geral: Financeiro › Exercícios (proposta) ─────────────────── */

/* Período do exercício = período da prestação de contas (Portaria 32968530/2025:
   abril a agosto e setembro a dezembro). Cada exercício tem um período; se o ano
   tiver mais de um, abre-se um exercício para cada um ("2027 jan–jun",
   "2027 jul–dez"). Os meses do período são os meses de repasse: a previsão de
   cada escola é o valor mensal da planilha × esses meses. */
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const PERIODO_ANO = { ini: 1, fim: 12, prazo: "" };
function periodoDe(ex) {
  if (ex && ex.periodo) return ex.periodo;
  if (ex && ex.periodos && ex.periodos.length) return { ini: Math.min(...ex.periodos.map((p) => p.ini)), fim: Math.max(...ex.periodos.map((p) => p.fim)), prazo: ex.periodos[ex.periodos.length - 1].prazo || "" };
  return PERIODO_ANO;
}
const qtdParcelas = (ex) => { const p = periodoDe(ex); return p.fim - p.ini + 1; };
const mesCurto = (m) => MESES[m - 1].slice(0, 3);
const dataBr = (iso) => (iso ? iso.split("-").reverse().join("/") : "");
const textoPeriodo = (p) => `${mesCurto(p.ini)}–${mesCurto(p.fim)}`;
const textoPeriodoLongo = (p) => `${MESES[p.ini - 1]} a ${MESES[p.fim - 1]}`;
const textoParcelas = (ex) => { const n = qtdParcelas(ex); return `${n} ${n === 1 ? "mês" : "meses"} (${textoPeriodoLongo(periodoDe(ex))})`; };

const anosRede = () => Object.keys(dados.exercicios).sort((a, b) => ordemEx(b, a));
/* Próximo exercício: continua o ano do último, se ele não foi até dezembro;
   senão, começa o ano seguinte em janeiro. */
function proximoExercicio() {
  const ult = anosRede()[0];
  if (!ult) return { ano: ANO_CORRENTE, ini: 1 };
  const p = periodoDe(dados.exercicios[ult]);
  return p.fim < 12 ? { ano: anoDe(ult), ini: p.fim + 1 } : { ano: anoDe(ult) + 1, ini: 1 };
}
function chaveNova(ano) {
  const n = Object.keys(dados.exercicios).filter((k) => anoDe(k) === ano).length;
  return n ? `${ano}.${n + 1}` : String(ano);
}

/* Uma linha por escola pública, a escola detalhada primeiro. */
function escolasNoAno(ano) {
  const ex = dados.exercicios[ano];
  const o = dados.ordinario[ano];
  const lista = [];
  if (o) {
    const ant = anterior(ano);
    const levados = dados.complementares.filter((r) => repNoAno(r, ano) && r.copiado && r.copiado[ano]).length;
    const zerados = dados.ordinario[ant] ? dados.complementares.filter((r) => repNoAno(r, ant) && !repNoAno(r, ano)).length : 0;
    const pend = [];
    if (!ordLigado(ano) && !o.saldoAnt) pend.push("Sem saldo anterior");
    if (o.previsao == null && ex.anexo) pend.push("Sem previsão");
    if (!dados.conta || dados.conta.situacao !== "Ativa") pend.push("Sem conta ativa");
    const saldoAnt = ordLigado(ano) ? (({ c, k }) => c + k)(ordSaldoTotal(ant)) : o.saldoAnt ? (o.saldoAnt.c || 0) + (o.saldoAnt.k || 0) : null;
    lista.push({ id: ESCOLA.id, nome: ESCOLA.nome, link: "#/", saldoAnt, previsao: o.previsao, levados, zerados, pend });
  }
  dados.rede.forEach((e) => {
    const a = e.anos[ano];
    if (!a) return;
    const pend = [];
    if (!e.anos[anterior(ano)] && !a.saldoAnt) pend.push("Sem saldo anterior");
    if (a.previsao == null && ex.anexo) pend.push("Sem previsão");
    if (!e.conta) pend.push("Sem conta ativa");
    lista.push({ id: e.id, nome: e.nome, link: null, saldoAnt: saldoAntRede(e, ano), previsao: a.previsao, levados: null, zerados: null, pend });
  });
  return lista;
}

const qtdEscolasPublicas = () => 1 + dados.rede.length;

/* Indicador de pendência (NN/g, "Indicators"; GOV.UK Tag; Carbon Status
   indicators): texto curto, tom de atenção e ícone, para não depender só da cor.
   Sem pendência, uma tag verde "Sem pendências": célula vazia parece que não
   carregou, e "—" quer dizer "não se aplica". */
const tagPendencia = (txt) => `<span class="tag tag--warning-light tag--pendencia"><i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i> ${esc(txt)}</span>`;
const TAG_SEM_PENDENCIAS = `<span class="tag tag--success-light tag--pendencia"><i class="fa-solid fa-check" aria-hidden="true"></i> Sem pendências</span>`;

/* Saldo do exercício anterior das outras escolas da rede. O protótipo só guarda a
   previsão delas, então o saldo é um valor fictício e estável: uma parte (2% a
   14%) da previsão do ano anterior. Escola sem exercício anterior e sem saldo
   informado fica sem valor (pendência "Primeiro exercício"). */
function saldoAntRede(e, ano) {
  const a = e.anos[ano];
  if (typeof a.saldoAnt === "number") return a.saldoAnt;
  const ant = e.anos[anterior(ano)];
  const base = ant ? ant.previsao : a.saldoAnt ? a.previsao : null;
  if (base == null) return ant ? 0 : null;
  const n = Number(String(e.id).replace(/\D/g, "")) || 1;
  return Math.round((base * (((n * 37) % 13) + 2)) / 100);
}

function telaExercicios() {
  const a = anosRede();
  const linhas = a.map((ano) => {
    const ex = dados.exercicios[ano];
    const escolas = escolasNoAno(ano);
    const comPend = escolas.filter((e) => e.pend.length).length;
    return `<tr class="linha-clicavel" data-href="#/financeiro/${ano}">
      <td><a href="#/financeiro/${ano}">${rotuloEx(ano)}</a></td>
      <td>${esc(ex.portaria)}</td>
      <td>${escolas.length}</td>
      <td>${ex.anexo ? `<span class="tag tag--success-light">Importada</span> <span class="texto-auxiliar">${esc(ex.anexo.data)}</span>` : `<span class="tag tag--warning-light">Não importada</span>`}</td>
      <td>${comPend ? tagPendencia(`${comPend} ${comPend > 1 ? "escolas" : "escola"}`) : TAG_SEM_PENDENCIAS}</td>
    </tr>`;
  }).join("");
  return `
    <section class="secao" aria-labelledby="t-exs">
      <div class="secao__cabecalho">
        <h2 class="secao__titulo secao__titulo--pagina" id="t-exs" tabindex="-1">Exercícios do PROAFE</h2>
        <a class="btn btn--secondary" href="#/financeiro/abrir"><i class="fa-solid fa-plus" aria-hidden="true"></i> Abrir exercício</a>
      </div>
    ${a.length ? `<div class="tabela-rolagem"><table class="tabela">
      <caption class="visually-hidden">Exercícios do PROAFE abertos para a rede</caption>
      <thead><tr><th scope="col">Exercício</th><th scope="col">Nº da portaria</th><th scope="col">Escolas</th><th scope="col">Planilha de valores</th><th scope="col">Pendências</th></tr></thead>
      <tbody>${linhas}</tbody></table></div>` : `<p class="vazio-texto">Nenhum exercício aberto.</p>`}
    </section>`;
}

function telaAbrirGeral() {
  // Exercício = o ano seguinte ao último aberto para a rede (sem período nem prazo,
  // reunião de 15/10/2026).
  const prox = proximoExercicio();
  const ano = prox.ini === 1 ? prox.ano : prox.ano + 1;
  const ant = anosRede()[0] || null;
  const e = ui.geralErros;
  const temAnterior = !!(ant && dados.ordinario[ant]);
  return `
    <div class="titulo-voltar">
      <a class="btn btn--tertiary btn--circle" href="#/financeiro/exercicios" aria-label="Voltar para Exercícios"><i class="fa-solid fa-arrow-left" aria-hidden="true"></i></a>
      <h1 class="conteudo__titulo" tabindex="-1">Abrir exercício</h1>
    </div>
    <p class="texto-apoio">O exercício ${ano} será aberto para as ${qtdEscolasPublicas()} escolas públicas${temAnterior ? `, com o saldo de ${rotuloEx(ant)} de cada uma e os repasses complementares que têm saldo` : ""}.${ant ? ` Abrir ${ano} não fecha ${rotuloEx(ant)}.` : ""}</p>
    <form id="form-abrir-geral" novalidate data-ano="${ano}">
      <section class="secao secao--compacta">
        <div class="formulario formulario--3">
          <div class="campo"><span class="campo__rotulo">Exercício</span><span class="campo__leitura">${ano}</span></div>
          ${campoTexto("geral-portaria", "Nº da portaria", ui.geralPortaria, true, e.portaria)}
        </div>
      </section>
      <div class="acoes-form">
        <button type="submit" class="btn btn--primary">Abrir exercício para a rede</button>
        <a class="btn btn--tertiary" href="#/financeiro/exercicios">Cancelar</a>
      </div>
    </form>`;
}

function telaExercicioGeral(ano) {
  const ex = dados.exercicios[ano];
  if (!ex) return naoEncontrado();
  const escolas = escolasNoAno(ano);
  const portaria = ui.portariaGeralEdit
    ? `<form id="form-portaria-geral" class="edicao-inline" novalidate>
        <label class="visually-hidden" for="in-portaria-geral">Nº da portaria</label>
        <input id="in-portaria-geral" class="controle" value="${esc(ex.portaria)}" ${ui.edit && ui.edit.erroPortaria ? 'aria-invalid="true" aria-describedby="er-portaria-geral"' : ""} />
        <button type="submit" class="btn btn--primary">Salvar</button>
        <button type="button" class="btn btn--tertiary" data-acao="portaria-geral-cancelar">Cancelar</button>
        ${ui.edit && ui.edit.erroPortaria ? erroCampo("er-portaria-geral", ui.edit.erroPortaria) : ""}
      </form>`
    : `<span>${esc(ex.portaria)}</span>${botaoIcone("portaria-geral-editar", "edit", "Editar o Nº da portaria")}`;
  const anexo = blocoAnexo(ano, ex);
  const filtrar = escolas.length > 15;
  const comPend = escolas.filter((e) => e.pend.length);
  // Ordem em dois níveis: primeiro pelas pendências (com pendência primeiro, ou o
  // contrário), depois pela coluna escolhida dentro de cada grupo (Escola, por padrão).
  // Pendências alterna o sentido do grupo; Escola e Previsão alternam crescente/decrescente.
  const porNome = (x, y) => x.nome.localeCompare(y.nome, "pt-BR", { sensitivity: "base", numeric: true });
  const ord = ui.escOrdem || { pendDir: "desc", col: "escola", dir: "asc" };
  const chaves = {
    escola: porNome,
    previsao: (x, y) => (x.previsao == null) - (y.previsao == null) || (x.previsao || 0) - (y.previsao || 0),
    mensal: (x, y) => (x.previsao == null) - (y.previsao == null) || (x.previsao || 0) - (y.previsao || 0),
    saldo: (x, y) => (x.saldoAnt == null) - (y.saldoAnt == null) || (x.saldoAnt || 0) - (y.saldoAnt || 0),
  };
  const ordenar = (l) => l.slice().sort((x, y) => {
    const g = (x.pend.length ? 1 : 0) - (y.pend.length ? 1 : 0);
    if (g) return ord.pendDir === "desc" ? -g : g;
    const c = chaves[ord.col](x, y);
    return (ord.dir === "asc" ? c : -c) || porNome(x, y);
  });
  const th = (col, rotulo) => {
    const dir = col === "pend" ? ord.pendDir : ord.col === col ? ord.dir : null;
    const sort = dir === "asc" ? "ascending" : dir === "desc" ? "descending" : "none";
    const icone = sort === "ascending" ? "fa-sort-up" : sort === "descending" ? "fa-sort-down" : "fa-sort";
    return `<th scope="col" aria-sort="${sort}"><button type="button" class="th-ordenavel" data-acao="esc-ordenar" data-col="${col}">${rotulo} <i class="fa-solid ${icone}" aria-hidden="true"></i></button></th>`;
  };
  const visiveis = ordenar(filtrar && ui.soPendencias ? comPend : escolas);
  const pagEsc = paginar("esc", visiveis, "lista de escolas");
  const parcelas = qtdParcelas(ex);
  const aguardando = `<span class="texto-auxiliar">Aguardando planilha</span>`;
  const linhas = pagEsc.fatia.map((e) => {
    const semPrev = e.previsao == null;
    return `<tr>
      <td>${e.link ? `<a class="lista-escolas__nome" href="${e.link}" data-ano="${ano}" data-acao-nav="escola">${esc(e.nome)}</a>` : `<span class="lista-escolas__nome">${esc(e.nome)}</span>`}<span class="celula-secundaria">CNPJ ${fmtCnpj(cnpjDaEscola(e.nome))}</span></td>
      <td>${e.saldoAnt == null ? naoInformado() : valorHtml(e.saldoAnt)}</td>
      <td>${semPrev ? (ex.anexo ? naoInformado("Não informada") : aguardando) : valorHtml(Math.round(e.previsao / parcelas))}</td>
      <td>${semPrev ? (ex.anexo ? naoInformado("Não informada") : aguardando) : valorHtml(e.previsao)}</td>
      <td>${e.pend.length ? `<span class="pendencias">${e.pend.map(tagPendencia).join("")}</span>` : TAG_SEM_PENDENCIAS}</td>
    </tr>`;
  }).join("");
  return `
    <div class="titulo-voltar">
      <a class="btn btn--tertiary btn--circle" href="#/financeiro/exercicios" aria-label="Voltar para Exercícios"><i class="fa-solid fa-arrow-left" aria-hidden="true"></i></a>
      <h1 class="conteudo__titulo" tabindex="-1">Exercício ${rotuloEx(ano)}</h1>
    </div>
    <p class="texto-auxiliar">Aberto em ${esc(ex.abertoEm)}, por ${esc(ex.por)}.</p>
    <section class="secao" aria-labelledby="t-eg-p">
      <h3 class="secao__titulo secao__titulo--h5" id="t-eg-p">Portaria</h3>
      <div class="campos-portaria">
        <div class="campo-portaria"><span class="campo__rotulo">Nº da portaria</span><div class="campo-portaria__valor">${portaria}</div></div>
      </div>
    </section>
    <section class="secao" aria-labelledby="t-eg-a">
      <h3 class="secao__titulo secao__titulo--h5" id="t-eg-a">Previsão do repasse anual</h3>
      ${anexo}
    </section>
    <section class="secao" aria-labelledby="t-eg-e">
      <h3 class="secao__titulo secao__titulo--h5" id="t-eg-e">Escolas</h3>
      ${nota("Pendências do protótipo, a validar com a UPC. Sem conta ativa: cadastrar a conta na escola. Sem saldo anterior: primeiro exercício da escola; informar o saldo na tela da escola. Sem previsão: a escola não veio na planilha (cadastrada depois ou linha com erro); informar na tela da escola. A falta da planilha não conta como pendência de cada escola: aparece como \"Aguardando planilha\".")}
      ${anterior(ano) ? alerta("info", "Repasses complementares", `Os repasses complementares com saldo em ${rotuloAnterior(ano)} foram levados para ${rotuloEx(ano)} com esse saldo. A previsão de cada um é informada na tela da escola.`) : ""}
      <p class="texto-auxiliar">${escolas.length} escolas públicas no exercício; ${comPend.length} com pendência.</p>
      ${filtrar ? `<label class="checkbox"><input type="checkbox" id="escolas-so-pend" ${ui.soPendencias ? "checked" : ""} /> Mostrar só escolas com pendência</label>` : ""}
      <div class="tabela-rolagem"><table class="tabela tabela--escolas-ex">
        <caption class="visually-hidden">Escolas públicas no exercício ${rotuloEx(ano)}</caption>
        <thead><tr>${th("escola", "Escola")}${th("saldo", `Saldo de ${rotuloAnterior(ano)} (R$)`)}${th("mensal", "Previsão do repasse mensal (R$)")}${th("previsao", "Previsão do repasse anual (R$)")}${th("pend", "Pendências")}</tr></thead>
        <tbody>${linhas || `<tr class="tabela__vazio"><td colspan="5">Nenhuma escola com pendência.</td></tr>`}</tbody></table></div>
      ${pagEsc.html}
    </section>`;
}

/* Nº da portaria: número, barra e o ano com quatro dígitos — ex.: 32968530/2025
   (Portaria do PROAFE de 2025). A quantidade de dígitos do número não é validada. */
const FORMATO_PORTARIA = /^\d+\/\d{4}$/;
function erroPortaria(v) {
  if (!v) return "Informe o número da portaria.";
  if (!FORMATO_PORTARIA.test(v)) return "Informe o número e o ano separados por barra, como 32968530/2025.";
  return null;
}

/* Máscara de digitação do Nº da portaria: só números e uma barra, e no máximo
   quatro dígitos depois dela (o ano). O número antes da barra não tem tamanho
   fixo, por isso não é uma máscara de posições como a de CPF. */
function mascaraPortaria(v) {
  const limpo = v.replace(/[^\d/]/g, "");
  const i = limpo.indexOf("/");
  return i < 0 ? limpo : limpo.slice(0, i + 1) + limpo.slice(i + 1).replace(/\//g, "").slice(0, 4);
}
document.addEventListener("input", (ev) => {
  const el = ev.target;
  if (el.id !== "geral-portaria" && el.id !== "in-portaria-geral") return;
  const novo = mascaraPortaria(el.value);
  if (novo !== el.value) {
    const pos = el.selectionStart - (el.value.length - novo.length);
    el.value = novo;
    el.setSelectionRange(Math.max(pos, 0), Math.max(pos, 0));
  }
});

function abrirExercicioGeral(form) {
  const anoNum = Number(form.dataset.ano);
  const ant = anosRede()[0] || null;
  const portaria = $("#geral-portaria").value.trim();
  ui.geralPortaria = portaria;
  ui.geralErros = {};
  const ep = erroPortaria(portaria);
  if (ep) {
    ui.geralErros.portaria = ep;
    ui.focar = "#geral-portaria";
    return render();
  }
  const ano = chaveNova(anoNum);
  const per = { ...PERIODO_ANO };
  dados.exercicios[ano] = { portaria, periodo: per, abertoEm: agora(), por: "sandra.madalena", anexo: null };
  // Escola detalhada: repasse ordinário + complementares com saldo (regra automática).
  const temAnterior = !!dados.ordinario[ant];
  dados.ordinario[ano] = { previsao: null, despesas: { c: null, k: null }, atualizacao: null };
  let levados = 0, zerados = 0;
  if (temAnterior) {
    dados.complementares.forEach((r) => {
      if (!repNoAno(r, ant)) return;
      if (repSaldoTotal(r, ant) !== 0) {
        r.valores[ano] = { previsao: null, despesas: null };
        r.copiado[ano] = true;
        levados++;
      } else zerados++;
    });
  }
  dados.rede.forEach((e) => (e.anos[ano] = { previsao: null }));
  registrar("Abertura de exercício", `Exercício ${rotuloEx(ano)} aberto para a rede (portaria ${portaria})${levados ? `, com ${levados} repasses complementares levados de ${rotuloEx(ant)}` : ""}`);
  ui.geralErros = {};
  ui.exSel = ano;
  ui.alertaCopia = levados ? { ano, de: ant, zerados } : null;
  ui.pagina = 1;
  salvar();
  navegar(`#/financeiro/${ano}`);
  ui.geralPortaria = "";
  toast(`Exercício ${rotuloEx(ano)} aberto para ${qtdEscolasPublicas()} escolas públicas. Importe a planilha de valores da portaria para preencher a previsão de cada escola.`);
}

function salvarPortariaGeral(form) {
  const v = form.querySelector("input").value.trim();
  const ano = partes()[1];
  const ep = erroPortaria(v);
  if (ep) {
    ui.edit = { erroPortaria: ep };
    ui.focar = "#in-portaria-geral";
    return render();
  }
  registrar("Alteração", `Exercício ${rotuloEx(ano)} — Nº da portaria: ${dados.exercicios[ano].portaria} → ${v}`);
  dados.exercicios[ano].portaria = v;
  ui.portariaGeralEdit = false;
  ui.edit = null;
  salvar();
  render();
  toast("Alterações salvas.");
}

/* ─── Importação da planilha de valores da portaria ─────────────────────────
   Lê a planilha (a aba "Anexo I" do .xls da SMED, ou um .xlsx/.csv), acha as
   colunas CNPJ e VALOR MENSAL pelo cabeçalho, ignora os cabeçalhos repetidos
   das quebras de página e cruza cada linha com o cadastro do SIE pelo CNPJ
   (reunião de 15/10/2026). A coluna Escola é opcional e serve para conferência.
   Nada é gravado antes de "Importar".

   Problemas, do mais grave para o mais leve:
   1. arquivo inválido — erro no campo do arquivo, não abre a prévia;
   2. planilha recusada — alguma escola já tem previsão no exercício (RN009);
   3. linha com erro — só a linha não é importada, as outras seguem (RN008);
   4. linha com aviso — importa (nome diferente do SIE). */

const normNome = (s) => String(s == null ? "" : s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\./g, "").replace(/\s+/g, " ").trim();

const soDigitos = (v) => String(v == null ? "" : v).replace(/\D/g, "");
function dvCnpj(base12) {
  const calc = (b, pesos) => { const r = b.split("").reduce((a, d, i) => a + Number(d) * pesos[i], 0) % 11; return r < 2 ? 0 : 11 - r; };
  const p1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const d1 = calc(base12, p1);
  return `${d1}${calc(base12 + d1, [6, ...p1])}`;
}
const cnpjValido = (d) => /^\d{14}$/.test(d) && !/^(\d)\1+$/.test(d) && dvCnpj(d.slice(0, 12)) === d.slice(12);
const fmtCnpj = (d) => (/^\d{14}$/.test(d) ? d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5") : d);
/* CNPJ fictício e válido de cada escola do exemplo; a EMEI JP Cirandinha usa o da lista de escolas. */
function cnpjDaEscola(nome) {
  if (nome === ESCOLA.nome) return "19720399000103";
  const l = linhasDaPlanilhaExemplo().find(([, n]) => n === nome);
  const base = String(92000000 + (l ? l[0] : 0) * 137).padStart(8, "0") + "0001";
  return base + dvCnpj(base);
}

/* Planilhas de exemplo para o protótipo mostrar cada situação. */
const SIMULACOES = {
  ok: { rotulo: "Planilha certa (todas as escolas)", arquivo: "Planilha_valores_PROAFE.xlsx" },
  problemas: { rotulo: "Com linhas com erro e aviso", arquivo: "Planilha_valores_PROAFE_com_problemas.xlsx" },
  "ja-tem": { rotulo: "Com escola que já tem previsão", arquivo: "Planilha_valores_PROAFE_repetida.xlsx" },
  "sem-colunas": { rotulo: "Sem a coluna CNPJ", arquivo: "Anexo_I_formato_antigo.xls" },
  vazia: { rotulo: "Planilha vazia", arquivo: "Planilha_valores_vazia.xlsx" },
  formato: { rotulo: "Arquivo em PDF", arquivo: "Portaria_PROAFE_2027.pdf" },
};

/* Linhas da planilha de exemplo: as do Anexo I e a escola que entrou em 2027. */
function linhasDaPlanilhaExemplo() {
  return ANEXO_I_EXEMPLO.linhas.concat([[ESCOLA_NOVA_2027.n, ESCOLA_NOVA_2027.nome, ESCOLA_NOVA_2027.mensal]]);
}

function linhasDoExemplo(variante = "ok") {
  const cab = ["Nº", "ESCOLA", "CNPJ", "ESTUDANTES (PARCIAL)", "ESTUDANTES (INTEGRAL)", "REPASSE CALCULADO", "VALOR MENSAL FINAL"];
  if (variante === "sem-colunas") return [["Nº", "ESCOLA", "VALOR MENSAL FINAL"], ...linhasDaPlanilhaExemplo().map(([n, e, m]) => [n, e, m / 100])];
  if (variante === "vazia") return [cab];
  const rows = [cab];
  // mesmas posições da planilha real: o cabeçalho se repete nas quebras de página
  const repetir = new Set([17, 36, 54, 72, 93]);
  linhasDaPlanilhaExemplo().forEach(([n, escola, mensal], i) => {
    if (repetir.has(i)) rows.push(cab.slice());
    let cnpj = fmtCnpj(cnpjDaEscola(escola)), nome = escola, valor = mensal / 100;
    if (variante === "problemas") {
      if (i === 10) cnpj = "";
      if (i === 20) cnpj = cnpj.slice(0, -1) + ((Number(cnpj.slice(-1)) + 1) % 10);
      if (i === 30) valor = "a definir";
      if (i === 50) nome = "EMEF Pres. Vargas";
    }
    rows.push([n, nome, cnpj, "", "", "", valor]);
    if (variante === "problemas" && i === 4) rows.push(["", "EMEI Nova Esperança", "12.345.678/0001-95", "", "", "", 1250]);
  });
  if (variante === "problemas") {
    const [n, e, m] = ANEXO_I_EXEMPLO.linhas[40];
    rows.push([n, e, fmtCnpj(cnpjDaEscola(e)), "", "", "", m / 100]);
  }
  return rows;
}

function lerAnexo(rows) {
  const cabIdx = rows.findIndex((r) => r.some((c) => normNome(c) === "cnpj") && r.some((c) => /valor mensal/.test(normNome(c))));
  if (cabIdx < 0) return { erro: "A planilha precisa ter as colunas CNPJ e Valor mensal. Confira o cabeçalho e selecione o arquivo de novo." };
  const cab = rows[cabIdx].map(normNome);
  const cE = cab.indexOf("escola");
  const cC = cab.indexOf("cnpj");
  const cV = cab.findIndex((c) => /valor mensal final/.test(c)) >= 0 ? cab.findIndex((c) => /valor mensal final/.test(c)) : cab.findIndex((c) => /valor mensal/.test(c));
  const linhas = [];
  let cabecalhos = 0;
  for (let i = cabIdx + 1; i < rows.length; i++) {
    const r = rows[i] || [];
    if (r.every((c) => c === "" || c == null)) continue;
    if (normNome(r[cC]) === "cnpj") { cabecalhos++; continue; }
    const escola = cE >= 0 ? String(r[cE] == null ? "" : r[cE]).trim() : "";
    const cnpjBruto = String(r[cC] == null ? "" : r[cC]).trim();
    let mensal = null;
    const bruto = r[cV];
    if (typeof bruto === "number") mensal = Math.round(bruto * 100);
    else {
      const pv = parseValor(String(bruto == null ? "" : bruto));
      if (!pv.vazio && !pv.erro) mensal = pv.valor;
    }
    linhas.push({ linha: i + 1, escola, cnpjBruto, cnpj: soDigitos(cnpjBruto), mensal, valorVazio: bruto === "" || bruto == null });
  }
  if (!linhas.length) return { erro: "A planilha não tem nenhuma linha de escola. Confira se selecionou o arquivo certo." };
  return { linhas, cabecalhos };
}

/* Previsão já gravada para a escola no exercício (manual ou de uma importação anterior). */
function previsaoAtual(id, ano) {
  if (id === ESCOLA.id) return dados.ordinario[ano] ? dados.ordinario[ano].previsao : null;
  const e = dados.rede.find((x) => x.id === id);
  return e && e.anos[ano] ? e.anos[ano].previsao : null;
}

/* Tipos de problema de uma linha: mensagem, o que fazer e o grupo do resumo. */
const PROBLEMA_LINHA = {
  "nao-cadastrada": { grupo: "Escola não cadastrada no SIE", msg: () => "CNPJ não encontrado no SIE", fazer: "Cadastre a escola no SIE antes de importar esta linha." },
  "cnpj-vazio": { grupo: "CNPJ não informado ou inválido", msg: () => "CNPJ não informado", fazer: "Preencha o CNPJ na planilha." },
  "cnpj-invalido": { grupo: "CNPJ não informado ou inválido", msg: () => "CNPJ inválido", fazer: "Corrija o CNPJ na planilha." },
  "valor-invalido": { grupo: "Valor mensal inválido", msg: (l) => (l.valorVazio ? "Valor mensal não informado" : "Valor mensal inválido"), fazer: "Corrija o valor na planilha." },
  repetida: { grupo: "CNPJ repetido", msg: (l) => `CNPJ repetido (linha ${l.primeira} da planilha)`, fazer: "Deixe uma linha só para a escola." },
  "nome-diferente": { grupo: "Nome diferente do SIE", msg: () => "Nome diferente do SIE", fazer: "Nada a fazer: a linha é importada pelo CNPJ, com o nome do SIE." },
  "ja-tem": { grupo: "Já tem previsão", msg: () => "Já tem previsão neste exercício", fazer: "Tire esta escola da planilha." },
};

function cruzarAnexo(lido, ano, simJaTem) {
  const parcelas = qtdParcelas(dados.exercicios[ano]);
  const sie = [];
  if (dados.ordinario[ano]) sie.push({ id: ESCOLA.id, nome: ESCOLA.nome });
  dados.rede.forEach((e) => { if (e.anos[ano]) sie.push({ id: e.id, nome: e.nome }); });
  sie.forEach((e) => { e.cnpj = cnpjDaEscola(e.nome); });
  const porCnpj = new Map(sie.map((e) => [e.cnpj, e]));
  const primeira = new Map();
  const comValor = new Set();
  const linhas = lido.linhas.map((l) => {
    const erro = (tipo, extra = {}) => ({ ...l, ...extra, situacao: "erro", tipo });
    if (!l.cnpj) return erro("cnpj-vazio");
    if (!cnpjValido(l.cnpj)) return erro("cnpj-invalido");
    const e = porCnpj.get(l.cnpj);
    if (!e) return erro("nao-cadastrada");
    if (primeira.has(e.id)) return erro("repetida", { sie: e, primeira: primeira.get(e.id) });
    primeira.set(e.id, l.linha);
    if (l.mensal == null || l.mensal < 0) return erro("valor-invalido", { sie: e });
    const previsao = l.mensal * parcelas;
    if (previsaoAtual(e.id, ano) != null || (simJaTem && simJaTem.has(e.nome))) return { ...l, sie: e, previsao, situacao: "ja-tem", tipo: "ja-tem" };
    comValor.add(e.id);
    if (l.escola && normNome(l.escola) !== normNome(e.nome)) return { ...l, sie: e, previsao, situacao: "aviso", tipo: "nome-diferente" };
    return { ...l, sie: e, previsao, situacao: "ok" };
  });
  // RN009: escola que já tem previsão no exercício recusa a planilha inteira.
  const recusada = linhas.some((l) => l.situacao === "ja-tem");
  return { linhas, cabecalhos: lido.cabecalhos, semPrevisao: sie.filter((e) => !comValor.has(e.id)), recusada };
}

function prepararPrevia(ano, rows, arquivo, simJaTem, tamanho) {
  const lido = lerAnexo(rows);
  if (lido.erro) {
    ui.importacao = { ano, etapa: "escolher", erro: lido.erro, arquivoErro: arquivo };
    ui.focar = FOCO_ARQUIVO;
    return render();
  }
  ui.importacao = { ano, etapa: "previa", arquivo, tamanho, res: cruzarAnexo(lido, ano, simJaTem), filtro: "todas" };
  ui.pag.anx.pagina = 1;
  ui.focar = "#t-previa";
  render();
}

function simularPlanilha(ano, variante) {
  const sim = SIMULACOES[variante];
  if (variante === "formato") {
    ui.importacao = { ano, etapa: "escolher", erro: "O arquivo não é uma planilha. Envie um arquivo XLS, XLSX ou CSV.", arquivoErro: sim.arquivo };
    ui.focar = FOCO_ARQUIVO;
    return render();
  }
  const jaTem = variante === "ja-tem" ? new Set(ANEXO_I_EXEMPLO.linhas.slice(5, 8).map(([, n]) => n)) : null;
  const tamanho = variante === "vazia" ? 6 * 1024 : 38 * 1024 + variante.length * 517;
  simularEnvio(ano, sim.arquivo, tamanho, () => prepararPrevia(ano, linhasDoExemplo(variante === "ja-tem" ? "ok" : variante), sim.arquivo, jaTem, tamanho));
}

/* ─── Anexar arquivo — componente do DS (Figma Sala de Aula 8010-57158 e
   estados 8010-57563): rótulo, formatos aceitos, botão "Adicionar arquivo" e o
   item do arquivo em três estados: enviando (barra de progresso e cancelar),
   enviado (tipo, tamanho e lixeira) e com erro (borda e mensagem). O input de
   arquivo fica escondido; o botão abre a janela de escolha. */
const FOCO_ARQUIVO = '[data-acao="escolher-arquivo"]';
const extensaoDe = (nome) => ((nome || "").match(/\.([^.]+)$/) || [, ""])[1].toUpperCase();
const tamanhoDe = (b) => (b == null ? "" : b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1048576).toFixed(2).replace(".", ",")} MB`);

function itemArquivo(estado, nome, op = {}) {
  if (estado === "enviando") {
    return `<div class="arquivo-item arquivo-item--enviando">
      <div class="arquivo-item__linha">
        <i class="fa-solid fa-circle-notch fa-spin arquivo-item__icone" aria-hidden="true"></i>
        <span class="arquivo-item__nome">${esc(nome)}</span>
        <button type="button" class="btn-icone arquivo-item__acao" data-acao="anexo-cancelar-envio" aria-label="Cancelar o envio de ${esc(nome)}"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>
      </div>
      <div class="arquivo-item__progresso" role="progressbar" aria-label="Enviando ${esc(nome)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${op.progresso || 0}">
        <span>Enviando…</span><span class="arquivo-item__barra"><span style="width:${op.progresso || 0}%"></span></span><span class="arquivo-item__pct">${op.progresso || 0}%</span>
      </div>
    </div>`;
  }
  if (estado === "erro") {
    return `<div class="arquivo-item arquivo-item--erro">
      <div class="arquivo-item__linha">
        <i class="fa-solid fa-file arquivo-item__icone" aria-hidden="true"></i>
        <span class="arquivo-item__nome">${esc(nome)}</span>
        <button type="button" class="btn-icone btn-icone--perigo arquivo-item__acao" data-acao="anexo-limpar-erro" aria-label="Remover ${esc(nome)}"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>
      </div>
      ${erroCampo("in-anexo-erro", op.erro)}
    </div>`;
  }
  return `<div class="arquivo-item">
      <div class="arquivo-item__linha">
        <i class="fa-solid fa-file arquivo-item__icone" aria-hidden="true"></i>
        <span class="arquivo-item__nome">${esc(nome)}</span>
        <span class="arquivo-item__meta">${extensaoDe(nome)}${op.tamanho != null ? ` | ${tamanhoDe(op.tamanho)}` : ""}</span>
        ${op.remover ? `<button type="button" class="btn-icone btn-icone--perigo arquivo-item__acao" data-acao="${op.remover}" aria-label="Remover ${esc(nome)}"><i class="fa-solid fa-trash" aria-hidden="true"></i></button>` : ""}
      </div>
    </div>`;
}

/* Envio do arquivo (no protótipo, só a animação da barra antes de ler). */
let envioAtual = 0;
function simularEnvio(ano, nome, tamanho, depois) {
  const id = ++envioAtual;
  ui.importacao = { ano, etapa: "enviando", arquivo: nome, tamanho, progresso: 0 };
  render();
  const passo = () => {
    const imp = ui.importacao;
    if (id !== envioAtual || !imp || imp.etapa !== "enviando") return;
    imp.progresso = Math.min(100, imp.progresso + 25);
    const barra = $(".arquivo-item__barra > span"), pct = $(".arquivo-item__pct"), prog = $(".arquivo-item__progresso");
    if (barra) barra.style.width = `${imp.progresso}%`;
    if (pct) pct.textContent = `${imp.progresso}%`;
    if (prog) prog.setAttribute("aria-valuenow", imp.progresso);
    if (imp.progresso < 100) setTimeout(passo, 220);
    else setTimeout(() => { if (id === envioAtual && ui.importacao && ui.importacao.etapa === "enviando") depois(); }, 200);
  };
  setTimeout(passo, 220);
}

function campoArquivo(ano, imp) {
  const enviando = imp.etapa === "enviando";
  return `<div class="campo campo-arquivo${imp.erro ? " campo--erro" : ""}" role="group" aria-labelledby="in-anexo-rotulo">
      <span class="campo__rotulo" id="in-anexo-rotulo">Planilha de valores por escola<span class="obrigatorio" aria-hidden="true">*</span></span>
      <p class="campo__ajuda" id="in-anexo-ajuda">Formatos: XLS, XLSX ou CSV</p>
      <input type="file" id="in-anexo" class="visually-hidden" tabindex="-1" aria-hidden="true" accept=".xls,.xlsx,.csv" data-ano="${ano}" />
      ${enviando ? itemArquivo("enviando", imp.arquivo, { progresso: imp.progresso })
        : `<button type="button" class="btn btn--secondary campo-arquivo__botao" data-acao="escolher-arquivo" aria-describedby="in-anexo-ajuda${imp.erro ? " in-anexo-erro" : ""}"><i class="fa-solid fa-plus" aria-hidden="true"></i> Adicionar arquivo</button>`}
      ${imp.erro && !enviando ? itemArquivo("erro", imp.arquivoErro || "Arquivo", { erro: imp.erro }) : ""}
    </div>`;
}

let carregandoXlsx = null;
function carregarSheetJS() {
  if (window.XLSX) return Promise.resolve();
  if (!carregandoXlsx) carregandoXlsx = new Promise((ok, falha) => {
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
    s.onload = ok;
    s.onerror = () => { carregandoXlsx = null; falha(new Error("sem internet")); };
    document.head.append(s);
  });
  return carregandoXlsx;
}

function lerArquivoAnexo(ano, file) {
  if (!/\.(xls|xlsx|csv)$/i.test(file.name)) {
    ui.importacao = { ano, etapa: "escolher", erro: "O arquivo não é uma planilha. Envie um arquivo XLS, XLSX ou CSV.", arquivoErro: file.name };
    ui.focar = FOCO_ARQUIVO;
    return render();
  }
  simularEnvio(ano, file.name, file.size, () => lerConteudoAnexo(ano, file));
}

function lerConteudoAnexo(ano, file) {
  const r = new FileReader();
  const ehCsv = /\.csv$/i.test(file.name);
  r.onload = async () => {
    try {
      let rows;
      if (ehCsv) {
        const txt = r.result;
        const sep = (txt.split("\n")[0].match(/;/g) || []).length >= (txt.split("\n")[0].match(/,/g) || []).length ? ";" : ",";
        rows = txt.split(/\r?\n/).map((l) => l.split(sep).map((c) => c.replace(/^"|"$/g, "").trim()));
      } else {
        await carregarSheetJS();
        const wb = XLSX.read(r.result, { type: "array" });
        const nomeAba = wb.SheetNames.find((n) => normNome(n) === "anexo i") || wb.SheetNames[0];
        rows = XLSX.utils.sheet_to_json(wb.Sheets[nomeAba], { header: 1, defval: "" });
      }
      prepararPrevia(ano, rows, file.name, null, file.size);
    } catch (e) {
      ui.importacao = { ano, etapa: "escolher", erro: `Não foi possível abrir o arquivo${e.message === "sem internet" ? " (a leitura de .xls precisa de internet para carregar o leitor de planilhas)" : ""}. Confira se ele não está corrompido ou protegido por senha.`, arquivoErro: file.name };
      ui.focar = FOCO_ARQUIVO;
      render();
    }
  };
  if (ehCsv) r.readAsText(file, "utf-8"); else r.readAsArrayBuffer(file);
}

const importaveis = (linhas) => linhas.filter((l) => l.situacao === "ok" || l.situacao === "aviso");

function confirmarImportacao() {
  const imp = ui.importacao;
  if (imp.res.recusada) return;
  const ano = imp.ano;
  const data = agora();
  const ok = importaveis(imp.res.linhas);
  ok.forEach((l) => {
    if (l.sie.id === ESCOLA.id) {
      const o = dados.ordinario[ano];
      registrar("Importação da planilha de valores", `Previsão do repasse anual de ${rotuloEx(ano)}: ${o.previsao == null ? "—" : fmt(o.previsao)} → ${fmt(l.previsao)}`);
      o.previsao = l.previsao;
      o.origemPrevisao = `${data}, por sandra.madalena`;
    } else dados.rede.find((e) => e.id === l.sie.id).anos[ano].previsao = l.previsao;
  });
  const problemas = imp.res.linhas.length - ok.length;
  dados.exercicios[ano].anexo = { data, por: "sandra.madalena", qtd: ok.length, fora: imp.res.semPrevisao.map((e) => e.nome), arquivo: imp.arquivo, problemas };
  registrar("Importação da planilha de valores", `Exercício ${rotuloEx(ano)}: ${imp.arquivo} — previsão de ${ok.length} escolas${problemas ? `, ${problemas} linhas não importadas` : ""}`);
  salvar();
  navegar(`#/financeiro/${ano}`);
  toast(`Planilha importada: previsão de ${ok.length} escolas.${problemas ? ` ${problemas} ${problemas > 1 ? "linhas não foram importadas" : "linha não foi importada"}.` : ""}`);
}

/* Baixa um .csv com as linhas que precisam ser corrigidas na planilha. */
function baixarLinhas(linhas, nomeArquivo) {
  const q = (v) => `"${String(v == null ? "" : v).replace(/"/g, '""')}"`;
  const csv = [["Linha da planilha", "Escola", "CNPJ", "Valor mensal", "Problema", "O que fazer"].map(q).join(";")]
    .concat(linhas.map((l) => [l.linha, l.escola || (l.sie && l.sie.nome) || "", l.cnpjBruto, l.mensal == null ? "" : fmt(l.mensal), PROBLEMA_LINHA[l.tipo].msg(l), PROBLEMA_LINHA[l.tipo].fazer].map(q).join(";")))
    .join("\r\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
  a.download = nomeArquivo;
  document.body.append(a);
  a.click();
  a.remove();
}

const SITUACAO_ANEXO = {
  ok: ["tag--success-light", "Pronta para importar"],
  aviso: ["tag--warning-light", "Importa com aviso"],
  erro: ["tag--danger-light", "Não será importada"],
  "ja-tem": ["tag--danger-light", "Já tem previsão"],
};

/* Importação da planilha de valores numa tela própria: só as etapas da importação
   (escolher o arquivo → prévia → importar), sem a portaria e sem a lista de
   escolas do exercício. Ao importar ou cancelar, volta para o exercício. */
function telaImportarAnexo(ano) {
  const ex = dados.exercicios[ano];
  if (!ex) return naoEncontrado();
  if (!ui.importacao || ui.importacao.ano !== ano) ui.importacao = { ano, etapa: "escolher" };
  return `
    <div class="titulo-voltar">
      <a class="btn btn--tertiary btn--circle" href="#/financeiro/${ano}" aria-label="Voltar para o Exercício ${rotuloEx(ano)}"><i class="fa-solid fa-arrow-left" aria-hidden="true"></i></a>
      <h1 class="conteudo__titulo" tabindex="-1">Importar planilha de valores</h1>
    </div>
    <p class="texto-auxiliar">Exercício ${rotuloEx(ano)} · Portaria nº ${esc(ex.portaria)}</p>
    <section class="secao">
      ${blocoAnexo(ano, ex)}
    </section>`;
}

const FILTROS_PREVIA = [["todas", "Todas"], ["erro", "Não serão importadas"], ["aviso", "Com aviso"], ["ok", "Prontas"]];

function blocoAnexo(ano, ex) {
  const imp = ui.importacao && ui.importacao.ano === ano ? ui.importacao : null;
  if (imp && imp.etapa === "previa") {
    const { linhas, cabecalhos, semPrevisao, recusada } = imp.res;
    const ok = importaveis(linhas);
    const avisos = linhas.filter((l) => l.situacao === "aviso");
    const erros = linhas.filter((l) => l.situacao === "erro");
    const jaTem = linhas.filter((l) => l.situacao === "ja-tem");
    const soma = ok.reduce((s, l) => s + l.previsao, 0);
    const conta = { todas: linhas.length, erro: erros.length, aviso: avisos.length, ok: linhas.filter((l) => l.situacao === "ok").length };
    const filtradas = imp.filtro === "todas" ? linhas
      : imp.filtro.startsWith("grupo:") ? linhas.filter((l) => l.tipo && PROBLEMA_LINHA[l.tipo].grupo === imp.filtro.slice(6))
      : linhas.filter((l) => l.situacao === imp.filtro || (imp.filtro === "erro" && l.situacao === "ja-tem"));
    const pagAnx = paginar("anx", filtradas, "prévia da importação");
    const grupos = {};
    erros.concat(avisos).forEach((l) => { const g = PROBLEMA_LINHA[l.tipo].grupo; grupos[g] = grupos[g] || { n: 0, aviso: l.situacao === "aviso" }; grupos[g].n++; });
    const nomesSem = `${semPrevisao.slice(0, 5).map((e) => e.nome).join(", ")}${semPrevisao.length > 5 ? ` e mais ${semPrevisao.length - 5}` : ""}`;
    const textoSem = `${semPrevisao.length} ${semPrevisao.length > 1 ? "escolas do SIE ficam" : "escola do SIE fica"} sem previsão: ${nomesSem}.`;
    const linkGrupo = (g, txt) => `<li><button type="button" class="link-botao" data-acao="anexo-grupo" data-grupo="${esc(g)}">${txt}</button></li>`;
    const resumoErros = !recusada && (erros.length || avisos.length)
      ? `<div class="alert ${erros.length ? "alert--danger" : "alert--warning"} resumo-erros" role="alert" aria-labelledby="t-resumo-erros">
          <i class="fa-solid ${erros.length ? "fa-circle-exclamation" : "fa-triangle-exclamation"} alert__icone" aria-hidden="true"></i>
          <div><p class="alert__titulo" id="t-resumo-erros">${erros.length ? `${erros.length} ${erros.length > 1 ? "linhas não serão importadas" : "linha não será importada"}` : `${avisos.length} ${avisos.length > 1 ? "linhas importam" : "linha importa"} com aviso`}</p>
          <p class="alert__corpo">${erros.length ? `As outras ${ok.length} escolas podem ser importadas.` : "Confira antes de importar."}${semPrevisao.length ? ` ${esc(textoSem)}` : ""}${erros.length || semPrevisao.length ? " Depois, corrija a planilha e importe só essas escolas, ou informe a previsão na tela de cada escola." : ""}</p>
          <ul class="resumo-erros__lista">${Object.entries(grupos).filter(([, v]) => !v.aviso).map(([g, v]) => linkGrupo(g, `${g}: ${v.n} ${v.n > 1 ? "linhas" : "linha"}`)).join("")}${Object.entries(grupos).filter(([, v]) => v.aviso).map(([g, v]) => linkGrupo(g, `${g} (importa): ${v.n} ${v.n > 1 ? "linhas" : "linha"}`)).join("")}</ul></div>
        </div>`
      : "";
    const filtroGrupo = imp.filtro.startsWith("grupo:")
      ? `<p class="texto-auxiliar">Mostrando só: <strong>${esc(imp.filtro.slice(6))}</strong> · <button type="button" class="link-botao" data-acao="anexo-filtro-limpar">Mostrar todas</button></p>`
      : "";
    return `
      <div class="campo campo-arquivo campo-arquivo--previa">
        <span class="campo__rotulo">Planilha de valores por escola</span>
        ${itemArquivo("enviado", imp.arquivo, { tamanho: imp.tamanho, remover: "anexo-outra" })}
      </div>
      <h3 class="secao__titulo secao__titulo--h5" id="t-previa" tabindex="-1">${recusada ? "Planilha recusada — nada foi gravado" : "Prévia da importação — nada foi gravado ainda"}</h3>
      ${recusada ? alerta("danger", `${jaTem.length} ${jaTem.length > 1 ? "escolas já têm" : "escola já tem"} previsão em ${rotuloEx(ano)}`, `${jaTem.slice(0, 5).map((l) => l.sie.nome).join(", ")}${jaTem.length > 5 ? ` e mais ${jaTem.length - 5}` : ""}. Nenhum valor foi gravado. Tire essas escolas da planilha e importe de novo.`) + nota("RN009: uma escola com previsão recusa a planilha inteira. A proposta 2.11b troca isso por \"Atualizar planilha\", que mostra só o que mudou.") : resumoErros}
      <p class="texto-auxiliar">${cabecalhos ? `${cabecalhos} cabeçalhos repetidos ignorados. ` : ""}Previsão anual = valor mensal × ${textoParcelas(dados.exercicios[ano])}, dividida em 80% custeio e 20% capital.</p>
      <div class="cartoes-resumo">
        <div class="cartao-resumo"><strong>${linhas.length}</strong><span>linhas de escola lidas</span></div>
        <div class="cartao-resumo cartao-resumo--ok"><strong>${recusada ? 0 : ok.length}</strong><span>prontas para importar</span></div>
        <div class="cartao-resumo ${avisos.length ? "cartao-resumo--alerta" : ""}"><strong>${avisos.length}</strong><span>com aviso (importam)</span></div>
        <div class="cartao-resumo ${erros.length || jaTem.length ? "cartao-resumo--erro" : ""}"><strong>${recusada ? linhas.length : erros.length}</strong><span>não serão importadas</span></div>
        ${recusada ? "" : `<div class="cartao-resumo ${semPrevisao.length ? "cartao-resumo--alerta" : ""}"><strong>${semPrevisao.length}</strong><span>escolas do SIE ficam sem previsão</span></div>`}
      </div>
      ${recusada ? "" : `<p class="texto-auxiliar">Total da previsão anual a importar: R$ ${valorHtml(soma)}.</p>`}
      ${!recusada && !resumoErros && semPrevisao.length ? alerta("warning", `${semPrevisao.length} ${semPrevisao.length > 1 ? "escolas do SIE não estão" : "escola do SIE não está"} na planilha`, `${nomesSem}. A previsão ${semPrevisao.length > 1 ? "delas" : "dela"} fica em branco. Depois, importe uma planilha só com ${semPrevisao.length > 1 ? "elas" : "ela"} ou informe a previsão na tela da escola.`) : ""}
      <fieldset class="radios radios--filtro">
        <legend class="visually-hidden">Mostrar as linhas</legend>
        ${FILTROS_PREVIA.filter(([v]) => v === "todas" || conta[v] || (v === "erro" && jaTem.length)).map(([v, r]) => `<label class="radio"><input type="radio" name="anexo-filtro" value="${v}" ${imp.filtro === v ? "checked" : ""} /> ${r} (${v === "erro" ? erros.length + jaTem.length : conta[v]})</label>`).join("")}
      </fieldset>
      ${filtroGrupo}
      <div class="tabela-rolagem"><table class="tabela">
        <caption class="visually-hidden">Prévia da importação da planilha de valores de ${rotuloEx(ano)}</caption>
        <thead><tr><th scope="col">Escola</th><th scope="col">CNPJ</th><th scope="col">Valor mensal (R$)</th><th scope="col">Previsão anual (R$)</th><th scope="col">Situação</th></tr></thead>
        <tbody>${pagAnx.fatia.length ? pagAnx.fatia.map((l) => {
          const p = l.tipo ? PROBLEMA_LINHA[l.tipo] : null;
          return `<tr${l.situacao === "erro" || l.situacao === "ja-tem" ? ' class="linha-erro"' : ""}>
          <td>${l.sie ? esc(l.sie.nome) : esc(l.escola || "—")}${l.situacao === "aviso" ? `<br><span class="texto-auxiliar">Na planilha: ${esc(l.escola)}</span>` : ""}</td>
          <td class="sem-quebra">${l.cnpjBruto ? esc(l.cnpjBruto) : "—"}</td>
          <td>${l.mensal == null ? "—" : valorHtml(l.mensal)}</td>
          <td>${l.previsao == null || l.situacao === "erro" ? "—" : valorHtml(l.previsao)}</td>
          <td><span class="tag ${SITUACAO_ANEXO[l.situacao][0]}">${SITUACAO_ANEXO[l.situacao][1]}</span>${p ? `<br><span class="texto-auxiliar"><strong>${esc(p.msg(l))}.</strong> ${esc(p.fazer)} Linha ${l.linha} da planilha.</span>` : ""}</td></tr>`;
        }).join("") : `<tr class="tabela__vazio"><td colspan="5">Nenhuma linha nesta situação.</td></tr>`}</tbody>
      </table></div>
      ${pagAnx.html}
      <div class="acoes-form">
        ${recusada
          ? `<button type="button" class="btn btn--primary" data-acao="anexo-outra">Escolher outra planilha</button>
        <button type="button" class="btn btn--secondary" data-acao="anexo-baixar" data-quais="ja-tem"><i class="fa-solid fa-download" aria-hidden="true"></i> Baixar lista das escolas</button>
        <button type="button" class="btn btn--tertiary" data-acao="anexo-cancelar">Cancelar</button>`
          : `<button type="button" class="btn btn--primary" data-acao="anexo-confirmar" ${ok.length ? "" : "disabled"}>Importar ${ok.length} ${ok.length === 1 ? "escola" : "escolas"}</button>
        ${erros.length ? `<button type="button" class="btn btn--secondary" data-acao="anexo-baixar" data-quais="erro"><i class="fa-solid fa-download" aria-hidden="true"></i> Baixar linhas com erro</button>` : ""}
        <button type="button" class="btn btn--tertiary" data-acao="anexo-cancelar">Cancelar</button>`}
      </div>`;
  }
  if (imp && (imp.etapa === "escolher" || imp.etapa === "enviando")) {
    return `
      <p class="texto-apoio">Selecione a planilha de valores da portaria, com as colunas <strong>CNPJ</strong> e <strong>Valor mensal</strong>. Antes de gravar, o sistema mostra uma prévia.</p>
      ${nota("A escola é encontrada pelo CNPJ (reunião de 15/10). A coluna Escola é opcional: nome diferente do SIE só gera aviso. A UPC pode organizar a planilha antes, desde que os valores sejam os da portaria.")}
      ${campoArquivo(ano, imp)}
      ${nota("Tamanho máximo do arquivo a definir com o desenvolvimento; o componente do DS prevê a linha \"Tamanho máximo\" e o erro \"Arquivo muito grande\".")}
      <div class="simulacao" role="group" aria-labelledby="t-simulacao">
        <p class="simulacao__titulo" id="t-simulacao"><i class="fa-solid fa-flask" aria-hidden="true"></i> Só no protótipo: usar uma planilha de exemplo</p>
        <div class="simulacao__botoes">
          ${Object.entries(SIMULACOES).map(([v, s]) => `<button type="button" class="btn ${v === "ok" ? "btn--secondary" : "btn--tertiary"}" data-acao="anexo-simular" data-var="${v}" data-ano="${ano}">${s.rotulo}</button>`).join("")}
        </div>
      </div>
      <div class="bloco-acao">
        <button type="button" class="btn btn--tertiary" data-acao="anexo-cancelar">Cancelar</button>
      </div>`;
  }
  return ex.anexo
    ? `<p class="atualizacao"><i class="fa-solid fa-circle-info" aria-hidden="true"></i> Planilha de valores importada em ${esc(ex.anexo.data)}${ex.anexo.por ? `, por ${esc(ex.anexo.por)}` : ""}: previsão de ${ex.anexo.qtd} ${ex.anexo.qtd > 1 ? "escolas" : "escola"}${ex.anexo.problemas ? `; ${ex.anexo.problemas} ${ex.anexo.problemas > 1 ? "linhas não importadas" : "linha não importada"}` : ""}${ex.anexo.fora.length ? `; sem previsão: ${esc(ex.anexo.fora.join(", "))}` : ""}.${ex.anexo.arquivo ? ` Arquivo: ${esc(ex.anexo.arquivo)}.` : ""}</p>
       <a class="btn btn--tertiary" href="#/financeiro/${ano}/importar"><i class="fa-solid fa-file-arrow-up" aria-hidden="true"></i> Importar de novo</a>`
    : `<p class="texto-apoio">Importe a planilha de valores da portaria para preencher a previsão do repasse anual de cada escola: valor mensal × ${textoParcelas(ex)}, dividida em 80% custeio e 20% capital.</p>
       <a class="btn btn--secondary" href="#/financeiro/${ano}/importar"><i class="fa-solid fa-file-arrow-up" aria-hidden="true"></i> Importar planilha</a>`;
}

document.addEventListener("change", (ev) => {
  const t = ev.target;
  if (t.id === "in-anexo" && t.files && t.files[0]) { const f = t.files[0]; t.value = ""; lerArquivoAnexo(t.dataset.ano, f); }
  else if (t.name === "anexo-filtro") {
    ui.importacao.filtro = t.value;
    ui.pag.anx.pagina = 1;
    ui.focar = `input[name="anexo-filtro"][value="${t.value}"]`;
    render();
  } else if (t.id === "escolas-so-pend") {
    ui.soPendencias = t.checked;
    ui.pag.esc.pagina = 1;
    ui.focar = "#escolas-so-pend";
    render();
  }
});

document.addEventListener("click", (ev) => {
  const alvo = ev.target.closest("[data-acao]");
  if (!alvo) return;
  const acao = alvo.dataset.acao;
  const imp = ui.importacao;
  if (acao === "anexo-simular") simularPlanilha(alvo.dataset.ano, alvo.dataset.var);
  else if (acao === "escolher-arquivo") $("#in-anexo").click();
  else if (acao === "anexo-cancelar-envio" || acao === "anexo-limpar-erro") { envioAtual++; ui.importacao = { ano: imp.ano, etapa: "escolher" }; ui.focar = FOCO_ARQUIVO; render(); }
  else if (acao === "anexo-cancelar") navegar(`#/financeiro/${imp.ano}`);
  else if (acao === "anexo-outra") { ui.importacao = { ano: imp.ano, etapa: "escolher" }; ui.focar = FOCO_ARQUIVO; render(); }
  else if (acao === "anexo-confirmar") confirmarImportacao();
  else if (acao === "anexo-grupo") { imp.filtro = "grupo:" + alvo.dataset.grupo; ui.pag.anx.pagina = 1; ui.focar = "#t-previa"; render(); }
  else if (acao === "anexo-filtro-limpar") { imp.filtro = "todas"; ui.pag.anx.pagina = 1; ui.focar = 'input[name="anexo-filtro"][value="todas"]'; render(); }
  else if (acao === "anexo-baixar") {
    const quais = alvo.dataset.quais;
    baixarLinhas(imp.res.linhas.filter((l) => l.situacao === quais), quais === "erro" ? "linhas-nao-importadas.csv" : "escolas-que-ja-tem-previsao.csv");
  }
});

/* ─── Campos de formulário ────────────────────────────────────────────────── */

function campoTexto(id, rotulo, valor, obrigatorio, erro, op = {}) {
  const descr = [erro ? `${id}-erro` : "", op.ajuda ? `${id}-ajuda` : ""].filter(Boolean).join(" ");
  const ctrl = op.longo
    ? `<textarea id="${id}" class="controle" ${descr ? `aria-describedby="${descr}"` : ""} ${erro ? 'aria-invalid="true"' : ""} ${obrigatorio ? 'aria-required="true"' : ""} placeholder="${esc(op.placeholder || "")}">${esc(valor || "")}</textarea>`
    : `<input id="${id}" class="controle ${op.monetario ? "controle--monetario" : ""}" ${op.monetario ? 'inputmode="decimal" placeholder="0,00"' : ""} ${op.lista ? `list="${op.lista}"` : ""}
        value="${esc(valor || "")}" ${descr ? `aria-describedby="${descr}"` : ""} ${erro ? 'aria-invalid="true"' : ""} ${obrigatorio ? 'aria-required="true"' : ""} autocomplete="off" />`;
  return `<div class="campo ${erro ? "campo--erro" : ""} ${op.largo ? "campo-largo" : ""}">
      <label class="campo__rotulo" for="${id}">${esc(rotulo)}${obrigatorio ? '<span class="obrigatorio" aria-hidden="true">*</span>' : ""}</label>
      ${op.prefixo ? `<div class="controle-prefixo"><span aria-hidden="true">${op.prefixo}</span>${ctrl}</div>` : ctrl}
      ${erro ? erroCampo(`${id}-erro`, erro) : ""}
      ${op.ajuda ? `<p class="campo__ajuda" id="${id}-ajuda">${esc(op.ajuda)}</p>` : ""}
    </div>`;
}

function campoSelect(id, rotulo, opcoes, valor, obrigatorio, erro, op = {}) {
  return `<div class="campo ${erro ? "campo--erro" : ""}">
      <label class="campo__rotulo" for="${id}">${esc(rotulo)}${obrigatorio ? '<span class="obrigatorio" aria-hidden="true">*</span>' : ""}</label>
      <select id="${id}" class="controle" ${erro ? `aria-invalid="true" aria-describedby="${id}-erro"` : ""} ${obrigatorio ? 'aria-required="true"' : ""}>
        ${op.vazio ? `<option value="">${esc(op.vazio)}</option>` : ""}
        ${opcoes.map((o) => {
          const [v, t] = Array.isArray(o) ? o : [o, o];
          return `<option value="${esc(v)}" ${String(v) === String(valor) ? "selected" : ""}>${esc(t)}</option>`;
        }).join("")}
      </select>
      ${erro ? erroCampo(`${id}-erro`, erro) : ""}
    </div>`;
}

function campoRadio(nome, rotulo, opcoes, valor, obrigatorio, erro) {
  return `<fieldset class="campo ${erro ? "campo--erro" : ""}" ${erro ? `aria-describedby="${nome}-erro"` : ""}>
      <legend class="campo__rotulo">${esc(rotulo)}${obrigatorio ? '<span class="obrigatorio" aria-hidden="true">*</span>' : ""}</legend>
      <div class="radios">${opcoes.map(([v, t]) => `<label class="radio"><input type="radio" name="${nome}" value="${v}" ${v === valor ? "checked" : ""} /> ${esc(t)}</label>`).join("")}</div>
      ${erro ? erroCampo(`${nome}-erro`, erro) : ""}
    </fieldset>`;
}

/* ─── Cadastro e edição de repasse complementar (FLUXO005) ───────────────── */

function telaForm(id) {
  const r = id ? dados.complementares.find((x) => x.id === id) : null;
  if (id && !r) return naoEncontrado();
  return `
    <div class="titulo-voltar">
      <a class="btn btn--tertiary btn--circle" href="${r ? `#/repasse/${r.id}` : "#/"}" aria-label="Voltar para ${r ? "o repasse" : "o PROAFE"}"><i class="fa-solid fa-arrow-left" aria-hidden="true"></i></a>
      <h2 class="conteudo__titulo" tabindex="-1">${r ? `Editar ${TIPOS[r.tipo].toLowerCase()}` : "Cadastrar repasse"}</h2>
    </div>
    <form id="form-repasse" class="formulario formulario--3" novalidate data-id="${r ? r.id : ""}">
      ${camposFormRepasse(r, ui.exSel)}
      <div class="campo-largo acoes-form">
        <button type="submit" class="btn btn--primary">Salvar</button>
        <a class="btn btn--tertiary" href="${r ? `#/repasse/${r.id}` : "#/"}">Cancelar</a>
      </div>
    </form>`;
}

/* Campos do formulário de repasse complementar — os mesmos na tela de cadastro,
   na tela de edição e na edição dentro da linha expandida da lista. */
function camposFormRepasse(r, ano) {
  const tipo = r ? r.tipo : ui.formTipo;
  const e = ui.formErros;
  const v = r || {};
  const anosOrigem = [];
  for (let x = anoDe(ano); x >= 2015; x--) anosOrigem.push(x); // todos os exercícios existentes até o da tela (RN028)

  let campos = "";
  const cat = campoRadio("f-categoria", "Categoria da despesa", [["custeio", "Custeio"], ["capital", "Capital"]], v.categoria, true, e.categoria);
  const assessor = () => {
    const a = v.assessor;
    return `${campoTexto("f-assessor", "Assessor de referência", a ? `${a.nome} · ${a.matricula} · ${a.cpf}` : "", false, e.assessor,
      { lista: "lista-servidores", ajuda: "Pesquise por nome, CPF ou matrícula." })}
      <datalist id="lista-servidores">${SERVIDORES.map((s) => `<option value="${esc(`${s.nome} · ${s.matricula} · ${s.cpf}`)}"></option>`).join("")}</datalist>
      <div id="assessor-escolhido" class="assessor-escolhido">${a ? assessorLeitura(a) : ""}</div>`;
  };
  if (tipo === "emenda" || tipo === "op") {
    const rot = tipo === "emenda" ? "Nº da emenda" : "Nº do orçamento participativo";
    campos = `${campoTexto("f-numero", rot, v.numero, true, e.numero, { ajuda: "Ex.: 00000001/2026" })}
      ${campoTexto("f-sei", "Nº do processo SEI", v.sei, true, e.sei)}
      ${cat}
      ${campoTexto("f-objeto", "Objeto", v.objeto, true, e.objeto, { longo: true, largo: true, placeholder: "Onde a escola vai gastar o recurso deste repasse" })}`;
  } else if (tipo === "programa") {
    const vigentes = PROGRAMAS.filter((p) => p.situacao === "Vigente").map((p) => p.nome).sort((a, b) => a.localeCompare(b, "pt-BR"));
    const opcoes = r && extinto(r) ? [r.item, ...vigentes] : vigentes;
    const p = v.item ? PROGRAMAS.find((x) => x.nome === v.item) : null;
    campos = `${campoSelect("f-item", "Programa", opcoes, v.item, true, e.item, { vazio: "Selecione" })}
      ${cat}
      <div class="campo-largo">${assessor()}</div>
      <div class="campo-largo" id="dados-item">${p ? dadosPrograma(p) : ""}</div>
      ${r && extinto(r) ? campoTexto("f-orientacao", "Orientação sobre o saldo", v.orientacao, false, null, { longo: true, largo: true }) : ""}`;
  } else if (tipo === "recurso") {
    campos = `${campoSelect("f-item", "Recurso", RECURSOS, v.item, true, e.item, { vazio: "Selecione" })}
      ${campoTexto("f-sei", "Nº do processo SEI", v.sei, true, e.sei)}
      ${cat}
      <div class="campo-largo">${assessor()}</div>
      ${campoTexto("f-objeto", "Objeto", v.objeto, true, e.objeto, { longo: true, largo: true, placeholder: "Detalhe do repasse — ex.: Reparo do telhado do bloco B" })}`;
  }

  const valores = !r && tipo ? `<div class="campo-largo">${tabelaValoresForm(ano)}</div>` : "";

  return `
      ${r
        ? `<div class="campo"><span class="campo__rotulo">Tipo de repasse</span><span class="campo__leitura">${esc(TIPOS[r.tipo])}</span></div>`
        : campoSelect("f-tipo", "Tipo de repasse", Object.entries(TIPOS), tipo, true, e.tipo, { vazio: "Selecione" })}
      <div class="campo"><span class="campo__rotulo">Exercício</span><span class="campo__leitura">${rotuloEx(ano)}</span></div>
      ${tipo ? (r
        ? `<div class="campo"><span class="campo__rotulo">Exercício de origem</span><span class="campo__leitura">${r.origem}</span></div>`
        : campoSelect("f-origem", "Exercício de origem", anosOrigem, anoDe(ano), true, e.origem)) : ""}
      ${campos}
      ${valores}`;
}

/* Tabela de valores do cadastro (FLUXO005, passo 8; RN023). Os valores ficam no
   formulário até o Salvar; "+ Valor" abre a edição na própria célula, como na
   tab PROAFE (FLUXO004). */
const LINHAS_FORM = [
  ["saldoAnt", (ano) => `(+) Saldo de ${rotuloAnterior(ano)}`],
  ["previsao", () => "(+) Previsão do repasse"],
  ["despesas", () => "(−) Despesas"],
];

function tabelaValoresForm(ano) {
  const fv = ui.formValores;
  const linhas = LINHAS_FORM.map(([campo, nome]) => {
    const rotulo = nome(ano);
    const ed = ui.formValorEdit;
    let celula;
    if (ed && ed.campo === campo) {
      const id = `fv-${campo}`;
      celula = miniform({
        tag: "div", attrs: `data-form-valor="${campo}"`, id, erro: ed.erro, rotulo,
        valor: ed.rascunho != null ? ed.rascunho : fmt(fv[campo]),
        botao: `<button type="button" class="btn btn--primary" data-acao="form-valor-salvar" data-campo="${campo}">Salvar</button>`,
        cancelar: `<button type="button" class="btn btn--tertiary" data-acao="form-valor-cancelar" data-campo="${campo}">Cancelar</button>`,
      });
    } else if (fv[campo] == null) {
      celula = `<button type="button" class="btn btn--tertiary btn--compacto" data-acao="form-valor-editar" data-campo="${campo}" aria-label="Informar ${esc(rotulo)}"><i class="fa-solid fa-plus" aria-hidden="true"></i> Valor</button>`;
    } else {
      celula = `<span class="celula-valor"><span>${valorHtml(fv[campo])}</span><span class="celula-valor__acoes">
          ${botaoIcone("form-valor-editar", "edit", `Editar ${rotulo}`, `data-campo="${campo}"`)}
          ${botaoIcone("form-valor-limpar", "trash", `Excluir ${rotulo}`, `data-campo="${campo}"`)}</span></span>`;
    }
    return `<tr><th scope="row">${rotulo}</th><td>${celula}</td></tr>`;
  }).join("");
  const total = (fv.saldoAnt || 0) + (fv.previsao || 0) - (fv.despesas || 0);
  return `<div class="tabela-rolagem"><table class="tabela tabela--valores tabela--valores-1">
      <caption class="visually-hidden">Valores do repasse em ${rotuloEx(ano)}</caption>
      <thead><tr><th scope="col">Valores</th><th scope="col">Valor (R$)</th></tr></thead>
      <tbody>${linhas}</tbody>
      <tfoot><tr class="linha-total"><th scope="row">Saldo total em ${rotuloEx(ano)}</th><td>${valorHtml(total)}</td></tr></tfoot>
    </table></div>`;
}

/* Valida e guarda o valor digitado na célula; devolve false quando há erro. */
function aplicarValorForm(campo) {
  const input = $(`#fv-${campo}`);
  const p = parseValor(input ? input.value : "");
  const negativo = campo === "saldoAnt";
  let erro = null;
  if (p.vazio) erro = campo === "previsao" ? "Informe a previsão." : "Informe o valor.";
  else if (p.erro || (!negativo && p.valor < 0))
    erro = negativo ? "O valor deve estar entre −999.999.999,99 e 999.999.999,99." : "O valor deve estar entre 0,00 e 999.999.999,99.";
  if (erro) {
    ui.formValorEdit = { campo, erro, rascunho: input ? input.value : "" };
    return false;
  }
  ui.formValores[campo] = p.valor;
  ui.formValorEdit = null;
  return true;
}

/* Refaz a tela do formulário sem perder o que já foi digitado nos campos. */
function refazerForm(focar) {
  const form = $("#form-repasse") || $("#form-detalhe");
  const vals = form ? $$("input:not([type=radio]), select, textarea", form).filter((el) => el.id && !el.id.startsWith("fv-")).map((el) => [el.id, el.value]) : [];
  const radio = form ? form.querySelector('input[name="f-categoria"]:checked') : null;
  const cat = radio ? radio.value : null;
  ui.focar = focar || null;
  render();
  vals.forEach(([id, v]) => {
    const el = document.getElementById(id);
    if (el && id !== "f-tipo") el.value = v;
  });
  if (cat) {
    const r = $(`input[name="f-categoria"][value="${cat}"]`);
    if (r) r.checked = true;
  }
  const item = $("#f-item");
  if (item && $("#dados-item")) {
    const p = PROGRAMAS.find((x) => x.nome === item.value);
    $("#dados-item").innerHTML = p ? dadosPrograma(p) : "";
  }
  const as = $("#f-assessor");
  if (as && $("#assessor-escolhido")) {
    const a = SERVIDORES.find((x) => `${x.nome} · ${x.matricula} · ${x.cpf}` === as.value);
    $("#assessor-escolhido").innerHTML = a ? assessorLeitura(a) : "";
  }
}

function assessorLeitura(a) {
  return `<div class="campos-leitura-grade campos-leitura-grade--2">
      <div><span class="campo__rotulo">Nome do assessor de referência</span><span class="campo__leitura">${esc(a.nome)}</span></div>
      <div><span class="campo__rotulo">Matrícula</span><span class="campo__leitura">${esc(a.matricula)}</span></div></div>`;
}

function dadosPrograma(p) {
  return `<div class="bloco-leitura">
      <p class="bloco-leitura__titulo">Dados do programa (Tabelas do Financeiro)</p>
      ${camposLeitura([
        ["Situação", `<span class="tag ${p.situacao === "Vigente" ? "tag--success-light" : "tag--danger-light"}">${esc(p.situacao)}</span>`, true],
        ["Nº do processo SEI", p.sei],
        ["Unidade de referência", p.unidade],
        ["Objeto", p.objeto],
      ])}</div>`;
}

/* ─── Visualização de repasse complementar (FLUXO008) ─────────────────────── */

function naoEncontrado() {
  return `<h2 class="conteudo__titulo" tabindex="-1">Repasse não encontrado</h2><p><a href="#/">Voltar ao PROAFE</a></p>`;
}

function camposDoRepasse(r, ano) {
  const p = r.tipo === "programa" ? programaDe(r) : null;
  const campos = [["Exercício", rotuloEx(ano)], ["Exercício de origem", String(r.origem)]];
  if (r.tipo === "emenda") campos.push(["Nº da emenda", r.numero], ["Nº do processo SEI", r.sei]);
  if (r.tipo === "op") campos.push(["Nº do orçamento participativo", r.numero], ["Nº do processo SEI", r.sei]);
  if (r.tipo === "programa") campos.push(["Programa", r.item]);
  if (r.tipo === "recurso") campos.push(["Recurso", r.item], ["Nº do processo SEI", r.sei]);
  campos.push(["Categoria da despesa", r.categoria === "custeio" ? "Custeio" : "Capital"]);
  if (r.assessor) campos.push(["Nome do assessor de referência", r.assessor.nome], ["Matrícula", r.assessor.matricula]);
  if (r.tipo === "programa" && p) campos.push(
    ["Situação", `<span class="tag ${p.situacao === "Vigente" ? "tag--success-light" : "tag--danger-light"}">${esc(p.situacao)}</span>`, true],
    ["Nº do processo SEI", p.sei], ["Unidade de referência", p.unidade]);
  const objeto = r.tipo === "programa" ? p && p.objeto : r.objeto;
  return `${extinto(r) ? alerta("warning", "Programa extinto", `O programa ${r.item} foi extinto. O repasse continua na escola até o saldo ser usado.`) : ""}
    ${camposLeitura(campos)}
    ${objeto ? camposLeitura([["Objeto", objeto]]) : ""}
    ${r.orientacao ? camposLeitura([["Orientação sobre o saldo", r.orientacao]]) : ""}`;
}

/* Corpo da linha expandida da lista (accordion do sistema, como o do boletim):
   fundo branco, os dados do repasse em campos e a tabela de valores. */
function detalheRepasse(r, ano) {
  if (ui.editandoDetalhe === r.id) {
    // Edição na própria linha: os campos da tela de edição, Salvar e Cancelar embaixo, à esquerda.
    return `<div class="detalhe-repasse">
        <form id="form-detalhe" class="formulario formulario--3" novalidate data-id="${r.id}" aria-label="Editar ${esc(TIPOS[r.tipo])} ${esc(ident(r))}">
          ${camposFormRepasse(r, ano)}
          <div class="campo-largo acoes-form">
            <button type="submit" class="btn btn--primary">Salvar</button>
            <button type="button" class="btn btn--tertiary" data-acao="cancelar-detalhe" data-id="${r.id}">Cancelar</button>
          </div>
        </form>
      </div>`;
  }
  return `<div class="detalhe-repasse">
      <div class="detalhe-repasse__topo">
        <div class="detalhe-repasse__campos">${camposDoRepasse(r, ano)}</div>
        ${smed() ? `<button type="button" class="btn btn--tertiary" data-acao="editar-detalhe" data-id="${r.id}"><i class="fa-solid fa-pen-to-square" aria-hidden="true"></i> Editar</button>` : ""}
      </div>
      <div>
        <h4 class="detalhe-repasse__subtitulo">Valores do repasse</h4>
        ${tabelaRepasse(r, ano)}
      </div>
    </div>`;
}

function tabelaRepasse(r, ano) {
  const v = r.valores[ano];
  const ligado = repLigado(r, ano);
  const esc_ = `rep:${r.id}:${ano}`;
  const linha = `(+) Saldo de ${rotuloAnterior(ano)}`;
  return `<div class="tabela-rolagem"><table class="tabela tabela--valores tabela--valores-1">
      <caption class="visually-hidden">Valores do repasse em ${rotuloEx(ano)}${ligado ? `. O saldo de ${rotuloAnterior(ano)} vem do exercício anterior e não é editável aqui.` : ""}</caption>
      <thead><tr><th scope="col">Valores</th><th scope="col">Valor (R$)</th></tr></thead>
      <tbody>
        <tr><th scope="row">${linha}</th><td>${celulaValor(esc_, "saldoAnt", "", repSaldoAnt(r, ano), { editavel: !ligado, rotulo: `${linha} — Valor` })}</td></tr>
        <tr><th scope="row">(+) Previsão do repasse</th><td>${celulaValor(esc_, "previsao", "", v.previsao, { editavel: true, rotulo: "Previsão do repasse — Valor" })}</td></tr>
        <tr><th scope="row">(−) Despesas</th><td>${celulaValor(esc_, "despesas", "", v.despesas, { editavel: true, lixeira: true, rotulo: "Despesas — Valor" })}</td></tr>
      </tbody>
      <tfoot><tr class="linha-total"><th scope="row">Saldo total em ${rotuloEx(ano)}</th><td>${valorHtml(repSaldoTotal(r, ano))}</td></tr></tfoot>
    </table></div>`;
}

/* ─── Ações ───────────────────────────────────────────────────────────────── */

function sufixoEncadeado(ano) {
  return ano !== maisRecente() ? ` O saldo anterior de ${rotuloEx(proximo(ano))} foi atualizado.` : "";
}

function anoDoEscopo(escopo) {
  return escopo === "ord" ? ui.exSel : escopo.split(":")[2];
}

function lerValorAtual(escopo, campo, cat) {
  const ano = anoDoEscopo(escopo);
  if (escopo === "ord") {
    const o = dados.ordinario[ano];
    if (campo === "saldoAnt") return ordSaldoAnt(ano)[cat];
    if (campo === "previsao") return o.previsao;
    return (o.despesas || {})[cat];
  }
  const r = dados.complementares.find((x) => x.id === escopo.split(":")[1]);
  if (campo === "saldoAnt") return repSaldoAnt(r, ano);
  return r.valores[ano][campo];
}

function gravarValor(escopo, campo, cat, valor) {
  const ano = anoDoEscopo(escopo);
  if (escopo === "ord") {
    const o = dados.ordinario[ano];
    if (campo === "saldoAnt") o.saldoAnt = { ...(o.saldoAnt || { c: 0, k: 0 }), [cat]: valor };
    else if (campo === "previsao") {
      o.previsao = valor;
      o.previsaoManual = `${agora()}, por sandra.madalena`;
    }
    else {
      o.despesas = { ...(o.despesas || {}), [cat]: valor };
      o.atualizacao = `${agora()}, por sandra.madalena`;
    }
    return `Repasse ordinário de ${rotuloEx(ano)}`;
  }
  const r = dados.complementares.find((x) => x.id === escopo.split(":")[1]);
  if (campo === "saldoAnt") r.valores[ano].saldoAnt = valor;
  else r.valores[ano][campo] = valor;
  return `${TIPOS[r.tipo]} ${ident(r)} em ${rotuloEx(ano)}`;
}

const NOMES = { saldoAnt: "Saldo anterior", previsao: "Previsão", despesas: "Despesas" };

function salvarCelula(form) {
  const { escopo, campo, cat } = form.dataset;
  const input = form.querySelector("input");
  const p = parseValor(input.value);
  const permiteNegativo = campo === "saldoAnt";
  let erro = null;
  if (p.vazio) erro = campo === "previsao" ? "Informe a previsão." : "Informe o valor.";
  else if (p.erro || (!permiteNegativo && p.valor < 0))
    erro = permiteNegativo ? "O valor deve estar entre −999.999.999,99 e 999.999.999,99." : "O valor deve estar entre 0,00 e 999.999.999,99.";
  if (erro) {
    ui.edit = { escopo, campo, cat, erro, rascunho: input.value };
    render();
    return;
  }
  const antes = lerValorAtual(escopo, campo, cat);
  const alvo = gravarValor(escopo, campo, cat, p.valor);
  registrar("Alteração", `${alvo} — ${NOMES[campo]}${cat ? (cat === "c" ? " de custeio" : " de capital") : ""}: ${antes == null ? "—" : fmt(antes)} → ${fmt(p.valor)}`);
  const ano = anoDoEscopo(escopo);
  ui.edit = null;
  salvar();
  render();
  const msg = escopo === "ord" && campo === "previsao" ? "Previsão do repasse ordinário salva com sucesso." : "Valor salvo com sucesso.";
  toast(msg + sufixoEncadeado(ano));
}

function excluirValor(btn) {
  const { escopo, campo, cat } = btn.dataset;
  confirmar(
    { titulo: "Excluir valor de despesa", texto: "Tem certeza de que deseja excluir o valor de despesa?", botao: "Excluir" },
    () => {
      const antes = lerValorAtual(escopo, campo, cat);
      const alvo = gravarValor(escopo, campo, cat, null);
      registrar("Exclusão", `${alvo} — Despesas${cat ? (cat === "c" ? " de custeio" : " de capital") : ""}: ${fmt(antes)} → —`);
      salvar();
      render();
      toast("Despesa excluída com sucesso." + sufixoEncadeado(anoDoEscopo(escopo)));
    }
  );
}

function salvarPortaria(form) {
  const v = form.querySelector("input").value.trim();
  if (!v) {
    ui.edit = { erroPortaria: "Informe o número da portaria." };
    ui.focar = "#in-portaria";
    return render();
  }
  const o = dados.ordinario[ui.exSel];
  registrar("Alteração", `Repasse ordinário de ${rotuloEx(ui.exSel)} — Nº da portaria: ${o.portaria || "—"} → ${v}`);
  o.portaria = v;
  ui.portariaEdit = false;
  ui.edit = null;
  salvar();
  render();
  toast("Alterações salvas.");
}

function salvarConta(form) {
  const nova = ui.contaForm === "nova";
  const val = (id) => ($(`#${id}`, form) ? $(`#${id}`, form).value.trim() : "");
  const marcado = (nome) => (form.querySelector(`input[name="${nome}"]:checked`) || {}).value || "";
  const c = { banco: marcado("conta-banco"), agencia: val("conta-agencia"), conta: val("conta-conta"), situacao: nova ? "Ativa" : marcado("conta-situacao") };
  const e = {};
  ui.contaSituacao = nova ? null : c.situacao;
  if (!nova && c.situacao === "Inativa" && dados.conta.situacao !== "Inativa") {
    const ei = erroInativarConta();
    if (ei) e.situacao = ei;
  }
  if (!c.agencia) e.agencia = "Informe a agência.";
  else if (c.agencia.length > 10) e.agencia = "A agência deve ter no máximo 10 caracteres.";
  if (!c.conta) e.conta = "Informe a conta.";
  else if (c.conta.length > 50) e.conta = "A conta deve ter no máximo 50 caracteres.";
  ui.contaErros = e;
  if (Object.keys(e).length) {
    ui.focar = e.agencia ? "#conta-agencia" : e.conta ? "#conta-conta" : 'input[name="conta-situacao"]:checked';
    return render();
  }
  const tinhaInativa = dados.conta && dados.conta.situacao === "Inativa";
  if (nova && dados.conta) dados.contasAnteriores.unshift({ ...dados.conta, situacao: "Inativa" });
  dados.conta = c;
  registrar(nova ? "Inclusão" : "Alteração", `Conta bancária ${c.banco} · ${c.agencia} · ${c.conta} (${c.situacao})`);
  ui.contaForm = null;
  ui.contaErros = {};
  ui.contaSituacao = null;
  salvar();
  render();
  if (nova && tinhaInativa) toast("Nova conta bancária cadastrada com sucesso. A conta anterior ficou inativa.");
  else toast("Conta bancária salva com sucesso.");
}

function salvarRepasse(form) {
  const id = form.dataset.id;
  const r = id ? dados.complementares.find((x) => x.id === id) : null;
  const tipo = r ? r.tipo : ui.formTipo;
  const val = (sel) => ($(sel, form) ? $(sel, form).value.trim() : "");
  const e = {};
  if (!tipo) e.tipo = "Informe o tipo de repasse.";
  const novo = {
    numero: val("#f-numero"),
    sei: val("#f-sei"),
    item: val("#f-item"),
    objeto: val("#f-objeto"),
    orientacao: val("#f-orientacao"),
    categoria: (form.querySelector('input[name="f-categoria"]:checked') || {}).value,
    origem: r ? r.origem : Number(val("#f-origem")),
  };
  const textoAssessor = val("#f-assessor");
  const assessor = SERVIDORES.find((s) => `${s.nome} · ${s.matricula} · ${s.cpf}` === textoAssessor) || null;
  if (tipo === "emenda" || tipo === "op") {
    if (!novo.numero) e.numero = tipo === "emenda" ? "Informe o número da emenda." : "Informe o número do orçamento participativo.";
    if (!novo.sei) e.sei = "Informe o número do processo SEI.";
    if (!novo.objeto) e.objeto = "Informe o objeto.";
  }
  if (tipo === "programa" && !novo.item) e.item = "Informe o programa.";
  if (tipo === "recurso") {
    if (!novo.item) e.item = "Informe o recurso.";
    if (!novo.sei) e.sei = "Informe o número do processo SEI.";
    if (!novo.objeto) e.objeto = "Informe o objeto.";
  }
  if (tipo && !novo.categoria) e.categoria = "Informe a categoria da despesa.";
  if (textoAssessor && !assessor) e.assessor = "Selecione um servidor da lista.";
  let valores = null;
  if (!r && tipo) {
    if (ui.formValorEdit && !aplicarValorForm(ui.formValorEdit.campo)) e.valor = true;
    else if (ui.formValores.previsao == null) {
      ui.formValorEdit = { campo: "previsao", erro: "Informe a previsão.", rascunho: "" };
      e.valor = true;
    }
    const fv = ui.formValores;
    valores = { saldoAnt: fv.saldoAnt == null ? 0 : fv.saldoAnt, previsao: fv.previsao, despesas: fv.despesas };
  }
  ui.formErros = e;
  if (Object.keys(e).length) {
    const ordem = ["tipo", "numero", "item", "sei", "categoria", "assessor", "objeto", "valor"];
    const k = ordem.find((x) => e[x]);
    const foco = { tipo: "#f-tipo", numero: "#f-numero", item: "#f-item", sei: "#f-sei", categoria: 'input[name="f-categoria"]', assessor: "#f-assessor", objeto: "#f-objeto", valor: ui.formValorEdit ? `#fv-${ui.formValorEdit.campo}` : null }[k];
    return refazerForm(foco);
  }
  const campos = { categoria: novo.categoria, assessor };
  if (tipo === "emenda" || tipo === "op") Object.assign(campos, { numero: novo.numero, sei: novo.sei, objeto: novo.objeto });
  if (tipo === "programa") Object.assign(campos, { item: novo.item, orientacao: novo.orientacao || (r && r.orientacao) });
  if (tipo === "recurso") Object.assign(campos, { item: novo.item, sei: novo.sei, objeto: novo.objeto });
  ui.formErros = {};
  if (r && form.id === "form-detalhe") {
    Object.assign(r, campos);
    registrar("Alteração", `${TIPOS[r.tipo]} ${ident(r)} — dados do repasse`);
    ui.editandoDetalhe = null;
    salvar();
    ui.focar = `[data-acao="editar-detalhe"][data-id="${r.id}"]`;
    render();
    toast("Alterações salvas.");
    return;
  }
  if (r) {
    Object.assign(r, campos);
    registrar("Alteração", `${TIPOS[r.tipo]} ${ident(r)} — dados do repasse`);
    salvar();
    navegar(`#/repasse/${r.id}`);
    toast("Alterações salvas.");
    return;
  }
  const nid = "n" + Date.now().toString(36);
  dados.complementares.push({ id: nid, tipo, origem: novo.origem, ...campos, valores: { [ui.exSel]: valores }, copiado: {} });
  registrar("Inclusão", `${TIPOS[tipo]} ${ident(dados.complementares[dados.complementares.length - 1])} em ${rotuloEx(ui.exSel)}`);
  ui.formTipo = "";
  limparValoresForm();
  salvar();
  navegar("#/");
  toast("Repasse complementar cadastrado com sucesso.", { href: `#/repasse/${nid}`, texto: "Ver repasse" });
}

/* ─── Eventos ─────────────────────────────────────────────────────────────── */

document.addEventListener("click", (ev) => {
  // Botão de envio: trata pelo clique (o Enter num campo também gera esse clique).
  const envio = ev.target.closest('button[type="submit"], form button:not([type])');
  if (envio && envio.form) {
    ev.preventDefault();
    const dlg = envio.closest("dialog");
    if (dlg) dlg.close(envio.value);
    else tratarEnvio(envio.form);
    return;
  }
  // Links internos ("#/...") viram navegação interna — ver `navegar`.
  const link = ev.target.closest('a[href^="#/"]');
  if (link && !link.dataset.acao && !ev.ctrlKey && !ev.metaKey && !ev.shiftKey) {
    ev.preventDefault();
    navegar(link.getAttribute("href"));
    return;
  }
  // Âncora da própria página ("Pular para o conteúdo"): leva o foco, sem sair da janela.
  const ancoraPagina = ev.target.closest('a[href^="#"]:not([href^="#/"])');
  if (ancoraPagina && ancoraPagina.getAttribute("href").length > 1) {
    const destino = document.getElementById(ancoraPagina.getAttribute("href").slice(1));
    if (destino) {
      ev.preventDefault();
      destino.focus();
      destino.scrollIntoView();
      return;
    }
  }
  const linha = ev.target.closest("tr.linha-clicavel");
  if (linha && !ev.target.closest("a, button")) {
    navegar(linha.dataset.href);
    return;
  }
  // Clicar em qualquer ponto da linha expansível abre ou fecha o detalhe.
  const exp = ev.target.closest("tr.linha-expansivel");
  if (exp && !ev.target.closest("a, button, input, select")) {
    exp.querySelector('[data-acao="alternar-detalhe"]').click();
    return;
  }
  const alvo = ev.target.closest("[data-acao]");
  if (!alvo) return;
  const acao = alvo.dataset.acao;
  if (acao !== "fora") ev.preventDefault();
  switch (acao) {
    case "fora":
      ev.preventDefault();
      toast("Esta parte do sistema não faz parte deste protótipo.", null, "info");
      break;
    case "conta-editar":
      ui.contaForm = "editar";
      ui.contaErros = {};
      ui.contaSituacao = null;
      ui.focar = 'input[name="conta-banco"]:checked';
      render();
      break;
    case "conta-nova":
      ui.contaForm = "nova";
      ui.contaErros = {};
      ui.focar = 'input[name="conta-banco"]:checked';
      render();
      break;
    case "conta-cancelar":
      ui.contaForm = null;
      ui.contaErros = {};
      ui.contaSituacao = null;
      render();
      break;
    case "portaria-editar":
      ui.portariaEdit = true;
      ui.edit = null;
      ui.focar = "#in-portaria";
      render();
      break;
    case "portaria-cancelar":
      ui.portariaEdit = false;
      ui.edit = null;
      render();
      break;
    case "portaria-geral-editar":
      ui.portariaGeralEdit = true;
      ui.edit = null;
      ui.focar = "#in-portaria-geral";
      render();
      break;
    case "portaria-geral-cancelar":
      ui.portariaGeralEdit = false;
      ui.edit = null;
      render();
      break;
    case "importar-anexo":
      ui.importacao = { ano: alvo.dataset.ano, etapa: "escolher" };
      ui.focar = FOCO_ARQUIVO;
      render();
      break;
    case "editar-valor":
      ui.edit = { escopo: alvo.dataset.escopo, campo: alvo.dataset.campo, cat: alvo.dataset.cat, erro: null, rascunho: null };
      ui.portariaEdit = false;
      render();
      break;
    case "excluir-valor":
      excluirValor(alvo);
      break;
    case "esc-ordenar": {
      const col = alvo.dataset.col;
      const o = ui.escOrdem || { pendDir: "desc", col: "escola", dir: "asc" };
      if (col === "pend") ui.escOrdem = { ...o, pendDir: o.pendDir === "desc" ? "asc" : "desc" };
      else ui.escOrdem = { ...o, col, dir: o.col === col && o.dir === "asc" ? "desc" : "asc" };
      ui.pag.esc.pagina = 1;
      ui.focar = `[data-acao="esc-ordenar"][data-col="${col}"]`;
      render();
      break;
    }
    case "ordenar": {
      const col = alvo.dataset.col;
      if (ui.ordem && ui.ordem.col === col) ui.ordem = ui.ordem.dir === "asc" ? { col, dir: "desc" } : null;
      else ui.ordem = { col, dir: "asc" };
      ui.pagina = 1;
      ui.focar = `[data-acao="ordenar"][data-col="${col}"]`;
      render();
      break;
    }
    case "pagina-anterior":
      ui.pagina--;
      ui.focar = '[data-acao="pagina-anterior"]';
      render();
      break;
    case "pagina-seguinte":
      ui.pagina++;
      ui.focar = '[data-acao="pagina-seguinte"]';
      render();
      break;
    case "alternar-detalhe": {
      const id = alvo.dataset.id;
      ui.expandidos = ui.expandidos.includes(id) ? ui.expandidos.filter((x) => x !== id) : [...ui.expandidos, id];
      ui.edit = null;
      ui.focar = `[data-acao="alternar-detalhe"][data-id="${id}"]`;
      render();
      break;
    }
    case "editar-detalhe":
      ui.editandoDetalhe = alvo.dataset.id;
      ui.formErros = {};
      ui.edit = null;
      ui.focar = "#form-detalhe input:not([type=hidden]), #form-detalhe select, #form-detalhe textarea";
      render();
      break;
    case "cancelar-detalhe":
      ui.editandoDetalhe = null;
      ui.formErros = {};
      ui.focar = `[data-acao="editar-detalhe"][data-id="${alvo.dataset.id}"]`;
      render();
      break;
    case "cancelar-valor": {
      // Fecha o campo sem gravar e devolve o foco ao lápis (ou ao "+ Valor") da célula.
      const { escopo, campo, cat } = alvo.dataset;
      ui.edit = null;
      ui.focar = `[data-acao="editar-valor"][data-escopo="${escopo}"][data-campo="${campo}"][data-cat="${cat}"]`;
      render();
      break;
    }
    case "form-valor-cancelar":
      ui.formValorEdit = null;
      refazerForm(`[data-campo="${alvo.dataset.campo}"][data-acao="form-valor-editar"]`);
      break;
    case "limpar-campo": {
      const input = alvo.closest(".edicao-celula__campo").querySelector("input");
      input.value = "";
      input.focus();
      break;
    }
    case "form-valor-editar":
      if (ui.formValorEdit && !aplicarValorForm(ui.formValorEdit.campo)) return refazerForm(`#fv-${ui.formValorEdit.campo}`);
      ui.formValorEdit = { campo: alvo.dataset.campo, erro: null, rascunho: null };
      refazerForm(`#fv-${alvo.dataset.campo}`);
      break;
    case "form-valor-salvar": {
      const campo = alvo.dataset.campo;
      const ok = aplicarValorForm(campo);
      refazerForm(ok ? `[data-campo="${campo}"][data-acao="form-valor-editar"]` : `#fv-${campo}`);
      break;
    }
    case "form-valor-limpar": {
      const campo = alvo.dataset.campo;
      ui.formValores[campo] = null;
      refazerForm(`[data-campo="${campo}"][data-acao="form-valor-editar"]`);
      break;
    }
    case "fechar-aviso-copia":
      ui.alertaCopia = null;
      ui.focar = "#t-comp";
      render();
      break;
  }
});

/* Envio dos formulários. Também é chamado pelo clique no botão de envio (ver o
   listener de click): numa janela isolada sem permissão de formulário
   (artefato), o navegador bloqueia o envio e o evento "submit" não acontece. */
function tratarEnvio(f) {
  if (f.classList.contains("edicao-celula")) salvarCelula(f);
  else if (f.id === "form-portaria") salvarPortaria(f);
  else if (f.id === "form-conta") salvarConta(f);
  else if (f.id === "form-abrir-geral") abrirExercicioGeral(f);
  else if (f.id === "form-filtro-rep") filtrarRep();
  else if (f.id === "form-busca-escolas") { ui.escBusca = $("#esc-busca").value.trim(); ui.focar = "#esc-busca"; render(); }
  else if (f.id === "form-portaria-geral") salvarPortariaGeral(f);
  else if (f.id === "form-repasse" || f.id === "form-detalhe") salvarRepasse(f);
}

document.addEventListener("submit", (ev) => {
  const f = ev.target;
  if (f.closest("dialog")) return;
  ev.preventDefault();
  tratarEnvio(f);
});

document.addEventListener("keydown", (ev) => {
  if (!(ev.target instanceof Element)) return;
  const fv = ev.target.closest("[data-form-valor]");
  if (fv && (ev.key === "Enter" || ev.key === "Escape")) {
    ev.preventDefault();
    const campo = fv.dataset.formValor;
    if (ev.key === "Enter") {
      const ok = aplicarValorForm(campo);
      refazerForm(ok ? `[data-campo="${campo}"][data-acao="form-valor-editar"]` : `#fv-${campo}`);
    } else {
      ui.formValorEdit = null;
      refazerForm(`[data-campo="${campo}"][data-acao="form-valor-editar"]`);
    }
    return;
  }
  if (ev.key === "Escape" && (ev.target.closest(".edicao-celula") || ev.target.closest("#form-portaria"))) {
    const escopo = ui.edit && ui.edit.escopo;
    ui.edit = null;
    ui.portariaEdit = false;
    render();
    const b = escopo ? $(`[data-acao="editar-valor"][data-escopo="${escopo}"]`) : null;
    if (b) b.focus();
  }
});

document.addEventListener("change", (ev) => {
  const t = ev.target;
  if (t.id === "sel-ex") {
    ui.exSel = t.value;
    ui.edit = null;
    ui.portariaEdit = false;
    ui.pagina = 1;
    ui.focar = "#sel-ex";
    render();
  } else if (t.id === "filtro-tipo") {
    ui.filtroTipo = t.value;
    ui.pagina = 1;
    ui.focar = "#filtro-tipo";
    render();
  } else if (t.id === "filtro-zerados") {
    ui.exibirZerados = t.checked;
    ui.pagina = 1; // volta para a página 1 (critério 11)
    ui.focar = "#filtro-zerados";
    render();
  } else if (t.id === "por-pagina") {
    ui.porPagina = Number(t.value);
    ui.pagina = 1;
    ui.focar = "#por-pagina";
    render();
  } else if (t.id === "pagina") {
    ui.pagina = Number(t.value);
    ui.focar = "#pagina";
    render();
  } else if (t.id === "f-tipo") {
    ui.formTipo = t.value;
    ui.formErros = {};
    ui.formValorEdit = null;
    refazerForm("#f-tipo");
  } else if (t.id === "f-item" && ui.formTipo === "programa") {
    const p = PROGRAMAS.find((x) => x.nome === t.value);
    $("#dados-item").innerHTML = p ? dadosPrograma(p) : "";
  } else if (t.id === "f-assessor") {
    const a = SERVIDORES.find((s) => `${s.nome} · ${s.matricula} · ${s.cpf}` === t.value);
    $("#assessor-escolhido").innerHTML = a ? assessorLeitura(a) : "";
  } else if (t.id === "perfil") {
    ui.perfil = t.value;
    ui.contaForm = null;
    ui.edit = null;
    salvar();
    if (!smed() && /financeiro|escolas|novo|editar/.test(rotaAtual)) navegar("#/");
    else render();
  } else if (t.id === "cenario") {
    ui.cenario = t.value;
    reiniciar();
  }
});

function reiniciar() {
  dados = estadoInicial(ui.cenario);
  abrirExercicioDeExemplo();
  Object.assign(ui, { exSel: null, edit: null, portariaEdit: false, contaForm: null, contaErros: {}, filtroTipo: "todos", exibirZerados: false, ordem: null, pagina: 1, alertaCopia: null, abrirSel: null, abrirErros: {}, formTipo: "", formErros: {} });
  limparValoresForm();
  salvar();
  if (rotaAtual !== "#/") navegar("#/");
  else render();
}

$("#restaurar").addEventListener("click", reiniciar);

function aoMudarDeTela() {
  ui.edit = null;
  ui.editandoDetalhe = null;
  ui.portariaEdit = false;
  ui.contaForm = null;
  if (!/novo/.test(rotaAtual)) ui.formTipo = "";
  limparValoresForm();
  ui.formErros = {};
  ui.abrirErros = {};
  ui.geralErros = {};
  if (!/financeiro\/abrir/.test(rotaAtual)) ui.geralPortaria = "";
  ui.portariaGeralEdit = false;
  const rotaImp = rotaAtual.match(/^#\/financeiro\/([^/]+)\/importar$/);
  ui.importacao = rotaImp ? { ano: rotaImp[1], etapa: "escolher" } : null;
  ui.pag.esc.pagina = 1;
  ui.abrirSel = null;
  const ancorou = render(true);
  if (!ancorou) window.scrollTo(0, 0);
}

// Voltar e avançar do navegador (quando o endereço acompanha a rota).
function aoMudarEndereco() {
  const rota = /^#\//.test(location.hash) ? location.hash : "#/";
  if (rota === rotaAtual) return;
  rotaAtual = rota;
  aoMudarDeTela();
}
window.addEventListener("hashchange", aoMudarEndereco);
window.addEventListener("popstate", aoMudarEndereco);

carregar();
$("#perfil").value = ui.perfil;
$("#cenario").value = ui.cenario;
render();

/* ─── Esconder a barra do protótipo (fica guardado neste navegador) ───────── */
(function () {
  const CHAVE_BARRA = "proafe-barra-oculta";
  const barra = document.getElementById("prototipo-barra");
  const mostrar = document.getElementById("mostrar-barra");
  if (!barra || !mostrar) return;
  function aplicar(oculta, focar) {
    barra.hidden = oculta;
    mostrar.hidden = !oculta;
    try { localStorage.setItem(CHAVE_BARRA, oculta ? "1" : ""); } catch (e) { /* sem armazenamento */ }
    if (focar) (oculta ? mostrar : document.getElementById("esconder-barra")).focus();
  }
  let oculta = false;
  try { oculta = localStorage.getItem(CHAVE_BARRA) === "1"; } catch (e) { /* sem armazenamento */ }
  aplicar(oculta, false);
  document.getElementById("esconder-barra").addEventListener("click", () => aplicar(true, true));
  mostrar.addEventListener("click", () => aplicar(false, true));
})();

/* "Mostrar comentários" na barra do protótipo: liga as notas para a equipe
   (nota()). Desligado por padrão; a escolha fica guardada no navegador. */
(function comentariosDoPrototipo() {
  const CHAVE_COMENTARIOS = "proafe-comentarios";
  const caixa = document.getElementById("mostrar-comentarios");
  if (!caixa) return;
  let ligado = false;
  try { ligado = localStorage.getItem(CHAVE_COMENTARIOS) === "1"; } catch (e) { /* sem armazenamento */ }
  caixa.checked = ligado;
  document.body.classList.toggle("com-comentarios", ligado);
  caixa.addEventListener("change", () => {
    document.body.classList.toggle("com-comentarios", caixa.checked);
    try { localStorage.setItem(CHAVE_COMENTARIOS, caixa.checked ? "1" : ""); } catch (e) { /* sem armazenamento */ }
  });
})();

/* ─── Validação ao sair do campo (on blur) ─────────────────────────────────────
   O erro aparece quando a pessoa sai do campo, não só ao salvar (NN/g, "Inline
   validation"), e some assim que o valor fica válido enquanto ela digita. As
   mensagens são as mesmas da validação ao salvar, que continua valendo. Clicar
   num botão ou link (Salvar, Cancelar, Limpar…) não dispara a validação, para o
   erro não piscar no meio de um Cancelar. */
function erroValorCelula(txt, campo) {
  const p = parseValor(txt);
  const negativo = campo === "saldoAnt";
  if (p.vazio) return campo === "previsao" ? "Informe a previsão." : "Informe o valor.";
  if (p.erro || (!negativo && p.valor < 0)) return negativo ? "O valor deve estar entre −999.999.999,99 e 999.999.999,99." : "O valor deve estar entre 0,00 e 999.999.999,99.";
  return null;
}

function tipoDoFormulario(el) {
  const f = el.closest("form");
  const r = f && f.dataset.id ? dados.complementares.find((x) => x.id === f.dataset.id) : null;
  return r ? r.tipo : ui.formTipo;
}

/* Devolve a mensagem de erro, null quando está válido, ou undefined quando o
   campo não tem validação. */
function validarNoCampo(el) {
  const id = el.id;
  const v = (el.value || "").trim();
  const obrig = (msg) => (v ? null : msg);
  switch (id) {
    case "geral-portaria":
    case "in-portaria-geral":
      return erroPortaria(v);
    case "conta-agencia":
      return !v ? "Informe a agência." : v.length > 10 ? "A agência deve ter no máximo 10 caracteres." : null;
    case "conta-conta":
      return !v ? "Informe a conta." : v.length > 50 ? "A conta deve ter no máximo 50 caracteres." : null;
    case "f-tipo":
      return obrig("Informe o tipo de repasse.");
    case "f-numero":
      return obrig(tipoDoFormulario(el) === "op" ? "Informe o número do orçamento participativo." : "Informe o número da emenda.");
    case "f-sei":
      return obrig("Informe o número do processo SEI.");
    case "f-objeto":
      return obrig("Informe o objeto.");
    case "f-item":
      return obrig(tipoDoFormulario(el) === "programa" ? "Informe o programa." : "Informe o recurso.");
    case "f-assessor":
      return !v || SERVIDORES.some((s) => `${s.nome} · ${s.matricula} · ${s.cpf}` === v) ? null : "Selecione um servidor da lista.";
  }
  const cel = el.closest(".edicao-celula");
  if (cel && el.matches("input.controle--monetario")) return erroValorCelula(el.value, cel.dataset.campo || (id.startsWith("fv-") ? id.slice(3) : ""));
  return undefined;
}

const idErro = (el) => (el.id === "in-portaria-geral" ? "er-portaria-geral" : `${el.id}-erro`);

function mostrarErroNoCampo(el, msg) {
  const eid = idErro(el);
  const caixa = el.closest(".edicao-celula") || el.closest(".campo") || el.closest(".edicao-inline");
  if (!caixa) return;
  let p = document.getElementById(eid);
  if (!p) {
    const tmp = document.createElement("div");
    tmp.innerHTML = erroCampo(eid, msg);
    p = tmp.firstElementChild;
    const acoes = caixa.querySelector(".edicao-celula__acoes");
    if (acoes) caixa.insertBefore(p, acoes);
    else caixa.appendChild(p);
  } else p.innerHTML = `<i class="fa-solid fa-circle-xmark" aria-hidden="true"></i> ${esc(msg)}`;
  el.setAttribute("aria-invalid", "true");
  const desc = new Set((el.getAttribute("aria-describedby") || "").split(/\s+/).filter(Boolean));
  desc.add(eid);
  el.setAttribute("aria-describedby", [...desc].join(" "));
  if (!caixa.classList.contains("edicao-inline")) caixa.classList.add("campo--erro");
}

function limparErroNoCampo(el) {
  const eid = idErro(el);
  const p = document.getElementById(eid);
  if (p) p.remove();
  el.removeAttribute("aria-invalid");
  const desc = (el.getAttribute("aria-describedby") || "").split(/\s+/).filter((x) => x && x !== eid);
  if (desc.length) el.setAttribute("aria-describedby", desc.join(" "));
  else el.removeAttribute("aria-describedby");
  const caixa = el.closest(".edicao-celula") || el.closest(".campo");
  if (caixa) caixa.classList.remove("campo--erro");
}

let clicandoAcao = false;
document.addEventListener("mousedown", (ev) => { clicandoAcao = !!ev.target.closest("button, a"); }, true);
document.addEventListener("mouseup", () => setTimeout(() => (clicandoAcao = false), 0), true);

document.addEventListener("focusout", (ev) => {
  const el = ev.target;
  if (!el.matches || !el.matches("input, select, textarea") || !el.isConnected || clicandoAcao) return;
  const msg = validarNoCampo(el);
  if (msg === undefined) return;
  if (msg) mostrarErroNoCampo(el, msg);
  else limparErroNoCampo(el);
});

function revalidarAoDigitar(ev) {
  const el = ev.target;
  if (!el.matches || el.getAttribute("aria-invalid") !== "true") return;
  const msg = validarNoCampo(el);
  if (msg === null) limparErroNoCampo(el);
}
document.addEventListener("input", revalidarAoDigitar);
// Situação da conta (radio): a trava aparece assim que "Inativa" é marcada. O erro
// fica no grupo (fieldset), descrito por ele.
document.addEventListener("change", (ev) => {
  const el = ev.target;
  if (el.name !== "conta-situacao") return;
  const grupo = el.closest("fieldset");
  const msg = el.value === "Inativa" && dados.conta && dados.conta.situacao !== "Inativa" ? erroInativarConta() : null;
  const atual = document.getElementById("conta-situacao-erro");
  if (atual) atual.remove();
  grupo.classList.toggle("campo--erro", !!msg);
  if (msg) {
    grupo.insertAdjacentHTML("beforeend", erroCampo("conta-situacao-erro", msg));
    grupo.setAttribute("aria-describedby", "conta-situacao-erro");
  } else grupo.removeAttribute("aria-describedby");
});
document.addEventListener("change", revalidarAoDigitar);
