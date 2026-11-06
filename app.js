'use strict';

/* =====================================================================
   Meu Treino — app de ficha de treino (uso pessoal, dados no aparelho)
   ===================================================================== */

const CHAVE = 'meu-treino-v1';
const PASSO_TIMER = 15;   // segundos
const MIN_TIMER = 15;
const MAX_TIMER = 600;

/* ---------------- Utilidades ---------------- */

const uid = () => Math.random().toString(36).slice(2, 10);
const pad = n => String(n).padStart(2, '0');
const paraISO = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const deISO = s => { const [a, m, d] = s.split('-').map(Number); return new Date(a, m - 1, d); };
const hojeISO = () => paraISO(new Date());
const somarDias = (iso, n) => { const d = deISO(iso); d.setDate(d.getDate() + n); return paraISO(d); };
const fmtData = iso => deISO(iso).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });
const fmtTempo = s => `${Math.floor(s / 60)}:${pad(s % 60)}`;
const buscaYouTube = nome => 'https://www.youtube.com/results?search_query=' + encodeURIComponent('como fazer ' + nome + ' execução correta');

/** Cria elementos: h('div', {class:'x', onclick: fn}, filho1, filho2...) */
function h(tag, attrs, ...filhos) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else if (k === 'value' || k === 'checked') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const f of filhos.flat()) {
    if (f == null || f === false) continue;
    el.append(f.nodeType ? f : String(f));
  }
  return el;
}

function aviso(msg) {
  const t = h('div', { class: 'toast' }, msg);
  document.body.append(t);
  setTimeout(() => t.remove(), 2200);
}

/* ---------------- Estado / armazenamento ---------------- */

function estadoInicial() {
  const ex = (nome, series, reps, carga) => ({ id: uid(), nome, video: '', series, reps, carga });
  return {
    fichas: [
      { id: uid(), nome: 'Treino A', exercicios: [
        ex('Supino reto com barra', 4, '10', '20'),
        ex('Crucifixo com halteres', 3, '12', '10'),
        ex('Tríceps na polia', 3, '12', '15'),
      ] },
      { id: uid(), nome: 'Treino B', exercicios: [
        ex('Puxada frontal', 4, '10', '35'),
        ex('Remada baixa', 3, '12', '30'),
        ex('Rosca direta', 3, '10', '10'),
      ] },
    ],
    // registros['2026-11-06'] = { presenca: 'sim'|'nao'|null, fichaId, ex: { [exId]: { feito, series, carga, nome } } }
    registros: {},
    intervalo: 30,
  };
}

function carregar() {
  try {
    const s = JSON.parse(localStorage.getItem(CHAVE));
    if (s && Array.isArray(s.fichas) && s.registros) return s;
  } catch (e) { /* ignora e recomeça */ }
  return estadoInicial();
}

let estado = carregar();
const salvar = () => localStorage.setItem(CHAVE, JSON.stringify(estado));

const ui = {
  aba: 'hoje',
  data: hojeISO(),
  fichaEdit: estado.fichas[0]?.id || null,
  editandoEx: null,
  mesCal: hojeISO().slice(0, 7),
};

const fichaPorId = id => estado.fichas.find(f => f.id === id);

function registro(iso, criar = false) {
  let r = estado.registros[iso];
  if (!r && criar) r = estado.registros[iso] = { presenca: null, fichaId: null, ex: {} };
  return r;
}

/** Última carga registrada para um exercício antes de uma data. */
function ultimaCarga(exId, antesDe) {
  const datas = Object.keys(estado.registros).filter(d => d < antesDe).sort().reverse();
  for (const d of datas) {
    const e = estado.registros[d].ex?.[exId];
    if (e && e.carga !== '' && e.carga != null) return { data: d, carga: e.carga };
  }
  return null;
}

function limparRegistroVazio(iso) {
  const r = estado.registros[iso];
  if (r && !r.presenca && !Object.values(r.ex).some(e => e.feito || e.series)) delete estado.registros[iso];
}

/* =====================================================================
   ABA: TREINO DO DIA
   ===================================================================== */

function renderHoje() {
  const raiz = document.getElementById('aba-hoje');
  raiz.replaceChildren();
  const iso = ui.data;
  const reg = registro(iso);

  // Seleção da data
  const cardData = h('div', { class: 'card' },
    h('div', { class: 'data-nav' },
      h('button', { onclick: () => { ui.data = somarDias(ui.data, -1); renderHoje(); }, 'aria-label': 'Dia anterior' }, '◀'),
      h('input', { type: 'date', value: iso, class: 'cresce', onchange: e => { if (e.target.value) { ui.data = e.target.value; renderHoje(); } } }),
      h('button', { onclick: () => { ui.data = somarDias(ui.data, 1); renderHoje(); }, 'aria-label': 'Próximo dia' }, '▶'),
      iso !== hojeISO() && h('button', { class: 'pequeno', onclick: () => { ui.data = hojeISO(); renderHoje(); } }, 'Hoje'),
    ),
    h('div', { class: 'presenca' },
      h('button', { class: 'sim' + (reg?.presenca === 'sim' ? ' on' : ''), onclick: () => marcarPresenca('sim') }, '✅ Fui à academia'),
      h('button', { class: 'nao' + (reg?.presenca === 'nao' ? ' on' : ''), onclick: () => marcarPresenca('nao') }, '❌ Não fui'),
    ),
  );
  raiz.append(cardData);

  if (!estado.fichas.length) {
    raiz.append(h('div', { class: 'card vazio' }, 'Nenhuma ficha cadastrada. Vá na aba "Fichas" para criar a sua.'));
    return;
  }

  // Seleção da ficha
  const fichaId = (reg?.fichaId && fichaPorId(reg.fichaId)) ? reg.fichaId : sugerirFicha(iso);
  const ficha = fichaPorId(fichaId);
  raiz.append(h('div', { class: 'card' },
    h('label', {}, 'Ficha do dia'),
    h('select', { onchange: e => { const r = registro(iso, true); r.fichaId = e.target.value; salvar(); renderHoje(); } },
      estado.fichas.map(f => h('option', { value: f.id, selected: f.id === fichaId }, f.nome)),
    ),
  ));

  // Progresso
  const feitos = ficha.exercicios.filter(e => reg?.ex?.[e.id]?.feito).length;
  const total = ficha.exercicios.length;
  raiz.append(h('h2', {}, `${ficha.nome} — ${feitos}/${total} feitos`));
  if (total) raiz.append(h('div', { class: 'progresso', style: 'margin:0 4px 12px' }, h('div', { style: `width:${(feitos / total) * 100}%` })));

  if (!total) raiz.append(h('div', { class: 'card vazio' }, 'Esta ficha não tem exercícios. Adicione na aba "Fichas".'));

  for (const ex of ficha.exercicios) raiz.append(cardExercicio(iso, ficha, ex));
}

/** Sugere a próxima ficha da sequência (A → B → C...) com base no último treino. */
function sugerirFicha(iso) {
  const ant = Object.keys(estado.registros).filter(d => d < iso && estado.registros[d].fichaId).sort().pop();
  if (ant) {
    const i = estado.fichas.findIndex(f => f.id === estado.registros[ant].fichaId);
    if (i >= 0) return estado.fichas[(i + 1) % estado.fichas.length].id;
  }
  return estado.fichas[0].id;
}

function marcarPresenca(valor) {
  const r = registro(ui.data, true);
  r.presenca = r.presenca === valor ? null : valor;
  limparRegistroVazio(ui.data);
  salvar();
  renderHoje();
}

/** Garante que o registro do dia aponte para a ficha que está na tela. */
function regDoDia(iso, ficha) {
  const r = registro(iso, true);
  if (!r.fichaId) r.fichaId = ficha.id;
  return r;
}

function cardExercicio(iso, ficha, ex) {
  const dados = registro(iso)?.ex?.[ex.id] || {};
  const feito = !!dados.feito;
  const seriesFeitas = dados.series || 0;
  const ult = ultimaCarga(ex.id, iso);
  const cargaAtual = dados.carga ?? ex.carga ?? '';

  const atualizar = (mudanca) => {
    const r = regDoDia(iso, ficha);
    const e = r.ex[ex.id] = { nome: ex.nome, carga: cargaAtual, ...r.ex[ex.id], ...mudanca };
    if (e.feito && !r.presenca) r.presenca = 'sim';   // fez exercício → foi à academia
    limparRegistroVazio(iso);
    salvar();
  };

  const linkVideo = ex.video || buscaYouTube(ex.nome);

  const seriesBtns = [];
  for (let i = 1; i <= (Number(ex.series) || 0); i++) {
    seriesBtns.push(h('button', {
      class: 'serie' + (i <= seriesFeitas ? ' on' : ''),
      onclick: () => {
        const novo = i <= seriesFeitas ? i - 1 : i;   // tocar numa série já feita desmarca a partir dela
        const completo = novo >= Number(ex.series);
        atualizar({ series: novo, feito: completo });
        if (novo > seriesFeitas) Timer.reiniciarEIniciar();   // terminou uma série → descanso
        renderHoje();
      },
    }, `${i}ª`));
  }

  return h('div', { class: 'card exercicio' + (feito ? ' feito' : '') },
    h('button', {
      class: 'check', 'aria-label': feito ? 'Desmarcar exercício' : 'Marcar como feito',
      onclick: () => { atualizar({ feito: !feito, series: !feito ? Number(ex.series) || 0 : 0 }); renderHoje(); },
    }, feito ? '✓' : ''),
    h('div', {},
      h('div', { class: 'linha' },
        h('div', { class: 'ex-nome cresce' }, h('a', { href: linkVideo, target: '_blank', rel: 'noopener' }, ex.nome)),
        h('a', { class: 'ex-video', href: linkVideo, target: '_blank', rel: 'noopener' }, ex.video ? '▶ Vídeo' : '🔎 Buscar vídeo'),
      ),
      h('div', { class: 'ex-meta' }, `${ex.series} séries × ${ex.reps} repetições`),
      h('div', { class: 'ex-campos' },
        h('div', {},
          h('label', {}, 'Carga hoje (kg)'),
          h('input', {
            type: 'text', inputmode: 'decimal', value: cargaAtual, placeholder: 'kg',
            onchange: e => {
              const v = e.target.value.trim().replace(',', '.');
              atualizar({ carga: v });
              ex.carga = v;          // a ficha passa a sugerir a carga mais recente
              salvar();
            },
          }),
          ult && h('div', { class: 'ultima' }, `Última: ${ult.carga} kg (${fmtData(ult.data)})`),
        ),
        h('div', {},
          h('label', {}, 'Repetições'),
          h('input', {
            type: 'text', value: ex.reps,
            onchange: e => { ex.reps = e.target.value.trim(); salvar(); renderHoje(); },
          }),
        ),
      ),
      seriesBtns.length > 0 && h('div', { class: 'series' }, seriesBtns,
        h('span', { class: 'dica' }, 'toque ao terminar a série → inicia o descanso')),
    ),
  );
}

/* =====================================================================
   ABA: FICHAS (cadastro)
   ===================================================================== */

function renderFichas() {
  const raiz = document.getElementById('aba-fichas');
  raiz.replaceChildren();

  if (!fichaPorId(ui.fichaEdit)) ui.fichaEdit = estado.fichas[0]?.id || null;

  raiz.append(h('div', { class: 'card' },
    h('div', { class: 'ficha-tabs' },
      estado.fichas.map(f => h('button', { class: f.id === ui.fichaEdit ? 'on' : '', onclick: () => { ui.fichaEdit = f.id; ui.editandoEx = null; renderFichas(); } }, f.nome)),
      h('button', { onclick: novaFicha }, '+ Nova ficha'),
    ),
  ));

  const ficha = fichaPorId(ui.fichaEdit);
  if (!ficha) {
    raiz.append(h('div', { class: 'card vazio' }, 'Crie sua primeira ficha tocando em "+ Nova ficha".'));
    raiz.append(cardBackup());
    return;
  }

  raiz.append(h('div', { class: 'card linha' },
    h('div', { class: 'cresce' },
      h('label', {}, 'Nome da ficha'),
      h('input', { value: ficha.nome, onchange: e => { ficha.nome = e.target.value.trim() || ficha.nome; salvar(); renderFichas(); } }),
    ),
    h('button', { class: 'perigo', style: 'align-self:flex-end', onclick: () => excluirFicha(ficha) }, '🗑️ Excluir'),
  ));

  raiz.append(h('h2', {}, `Exercícios (${ficha.exercicios.length})`));

  ficha.exercicios.forEach((ex, i) => {
    if (ui.editandoEx === ex.id) { raiz.append(formExercicio(ficha, ex)); return; }
    raiz.append(h('div', { class: 'card ex-item' },
      h('div', { class: 'info' },
        h('div', { class: 'ex-nome' }, ex.nome),
        h('div', { class: 'ex-meta' }, `${ex.series} × ${ex.reps} · ${ex.carga || '—'} kg`, ex.video ? ' · 🎬 vídeo' : ''),
      ),
      h('div', { class: 'acoes' },
        h('button', { class: 'pequeno', disabled: i === 0, onclick: () => mover(ficha, i, -1), 'aria-label': 'Subir' }, '↑'),
        h('button', { class: 'pequeno', disabled: i === ficha.exercicios.length - 1, onclick: () => mover(ficha, i, 1), 'aria-label': 'Descer' }, '↓'),
        h('button', { class: 'pequeno', onclick: () => { ui.editandoEx = ex.id; renderFichas(); }, 'aria-label': 'Editar' }, '✏️'),
      ),
    ));
  });

  raiz.append(h('h2', {}, ui.editandoEx === 'novo' ? 'Novo exercício' : ''));
  raiz.append(ui.editandoEx === 'novo'
    ? formExercicio(ficha, null)
    : h('button', { class: 'primario', style: 'width:100%', onclick: () => { ui.editandoEx = 'novo'; renderFichas(); } }, '+ Adicionar exercício'));

  raiz.append(cardBackup());
}

function formExercicio(ficha, ex) {
  const campo = (rotulo, attrs, cls) => h('div', { class: cls }, h('label', {}, rotulo), h('input', attrs));
  const nome = campo('Nome do exercício', { value: ex?.nome || '', placeholder: 'Ex.: Agachamento livre', required: true }, 'full');
  const video = campo('Link do vídeo (YouTube, Instagram...)', { type: 'url', value: ex?.video || '', placeholder: 'https://... (opcional)' }, 'full');
  const series = campo('Séries', { type: 'number', inputmode: 'numeric', min: 1, max: 20, value: ex?.series ?? 3 });
  const reps = campo('Repetições', { value: ex?.reps ?? '12', placeholder: '12 ou 8-12' });
  const carga = campo('Carga (kg)', { inputmode: 'decimal', value: ex?.carga ?? '', placeholder: 'kg' });
  const val = el => el.querySelector('input').value.trim();

  const salvarEx = () => {
    const dados = {
      nome: val(nome),
      video: val(video),
      series: Math.max(1, Math.min(20, parseInt(val(series), 10) || 1)),
      reps: val(reps) || '-',
      carga: val(carga).replace(',', '.'),
    };
    if (!dados.nome) { aviso('Informe o nome do exercício.'); return; }
    if (dados.video && !/^https?:\/\//i.test(dados.video)) dados.video = 'https://' + dados.video;
    if (ex) Object.assign(ex, dados); else ficha.exercicios.push({ id: uid(), ...dados });
    ui.editandoEx = null;
    salvar();
    renderFichas();
  };

  return h('div', { class: 'card' },
    h('div', { class: 'form-ex' }, nome, video, series, reps, carga),
    h('div', { class: 'linha', style: 'margin-top:10px' },
      h('button', { class: 'primario cresce', onclick: salvarEx }, 'Salvar'),
      h('button', { onclick: () => { ui.editandoEx = null; renderFichas(); } }, 'Cancelar'),
      ex && h('button', { class: 'perigo', onclick: () => {
        if (!confirm(`Excluir "${ex.nome}" da ficha?`)) return;
        ficha.exercicios = ficha.exercicios.filter(e => e.id !== ex.id);
        ui.editandoEx = null; salvar(); renderFichas();
      } }, '🗑️'),
    ),
    h('div', { class: 'ex-meta', style: 'margin-top:8px;font-size:.8rem' },
      'Sem link de vídeo, o app abre uma busca no YouTube pelo nome do exercício.'),
  );
}

function mover(ficha, i, d) {
  const arr = ficha.exercicios;
  [arr[i], arr[i + d]] = [arr[i + d], arr[i]];
  salvar(); renderFichas();
}

function novaFicha() {
  const letra = String.fromCharCode(65 + estado.fichas.length);
  const nome = prompt('Nome da nova ficha:', `Treino ${letra}`);
  if (!nome || !nome.trim()) return;
  const f = { id: uid(), nome: nome.trim(), exercicios: [] };
  estado.fichas.push(f);
  ui.fichaEdit = f.id; ui.editandoEx = 'novo';
  salvar(); renderFichas();
}

function excluirFicha(ficha) {
  if (!confirm(`Excluir a ficha "${ficha.nome}" e todos os seus exercícios? (o histórico de dias é mantido)`)) return;
  estado.fichas = estado.fichas.filter(f => f.id !== ficha.id);
  ui.fichaEdit = estado.fichas[0]?.id || null;
  salvar(); renderFichas();
}

function cardBackup() {
  const arquivo = h('input', { type: 'file', accept: 'application/json,.json', style: 'display:none', onchange: importar });
  return h('div', {},
    h('h2', {}, 'Backup'),
    h('div', { class: 'card' },
      h('div', { class: 'ex-meta', style: 'margin-bottom:10px' },
        'Os dados ficam salvos só neste aparelho/navegador. Exporte de vez em quando para não perder nada.'),
      h('div', { class: 'linha' },
        h('button', { class: 'cresce', onclick: exportar }, '⬇️ Exportar'),
        h('button', { class: 'cresce', onclick: () => arquivo.click() }, '⬆️ Importar'),
        arquivo,
      ),
    ),
  );
}

function exportar() {
  const blob = new Blob([JSON.stringify(estado, null, 2)], { type: 'application/json' });
  const a = h('a', { href: URL.createObjectURL(blob), download: `meu-treino-${hojeISO()}.json` });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function importar(e) {
  const f = e.target.files[0];
  if (!f) return;
  f.text().then(txt => {
    const dados = JSON.parse(txt);
    if (!Array.isArray(dados.fichas) || typeof dados.registros !== 'object') throw new Error('formato');
    if (!confirm('Substituir todos os dados atuais pelos do arquivo?')) return;
    estado = dados;
    estado.intervalo ||= 30;
    salvar();
    ui.fichaEdit = estado.fichas[0]?.id || null;
    Timer.definir(estado.intervalo);
    renderTudo();
    aviso('Backup importado!');
  }).catch(() => aviso('Arquivo inválido.'));
  e.target.value = '';
}

/* =====================================================================
   ABA: GABARITO (calendário de presença)
   ===================================================================== */

function renderCalendario() {
  const raiz = document.getElementById('aba-calendario');
  raiz.replaceChildren();

  const [ano, mes] = ui.mesCal.split('-').map(Number);
  const primeiro = new Date(ano, mes - 1, 1);
  const diasNoMes = new Date(ano, mes, 0).getDate();
  const hoje = hojeISO();
  const trocarMes = d => { const x = new Date(ano, mes - 1 + d, 1); ui.mesCal = paraISO(x).slice(0, 7); renderCalendario(); };

  let foi = 0, naoFoi = 0, exFeitos = 0;
  const celulas = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map(d => h('div', { class: 'dow' }, d));
  for (let i = 0; i < primeiro.getDay(); i++) celulas.push(h('div', { class: 'dia fora' }));

  for (let d = 1; d <= diasNoMes; d++) {
    const iso = `${ano}-${pad(mes)}-${pad(d)}`;
    const r = estado.registros[iso];
    const nFeitos = r ? Object.values(r.ex).filter(e => e.feito).length : 0;
    if (r?.presenca === 'sim') foi++;
    if (r?.presenca === 'nao') naoFoi++;
    exFeitos += nFeitos;
    const ficha = r?.fichaId && fichaPorId(r.fichaId);
    celulas.push(h('button', {
      class: 'dia' + (r?.presenca ? ' ' + r.presenca : '') + (iso === hoje ? ' hoje' : ''),
      title: ficha ? ficha.nome : '',
      onclick: () => { ui.data = iso; trocarAba('hoje'); },
    }, d, r?.presenca === 'sim' && h('small', {}, ficha ? abreviar(ficha.nome) : '✓')));
  }

  const nomeMes = primeiro.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).replace(/^./, c => c.toUpperCase());

  raiz.append(h('div', { class: 'card' },
    h('div', { class: 'cal-topo' },
      h('button', { onclick: () => trocarMes(-1), 'aria-label': 'Mês anterior' }, '◀'),
      h('strong', {}, nomeMes),
      h('button', { onclick: () => trocarMes(1), 'aria-label': 'Próximo mês' }, '▶'),
    ),
    h('div', { class: 'cal' }, celulas),
    h('div', { class: 'legenda' },
      h('span', {}, h('i', { style: 'background:var(--verde)' }), 'Fui'),
      h('span', {}, h('i', { style: 'background:#3b1111;border:1px solid var(--vermelho)' }), 'Não fui'),
      h('span', {}, h('i', { style: 'background:var(--card2);border:1px solid var(--borda)' }), 'Sem registro'),
    ),
    h('div', { class: 'ex-meta', style: 'margin-top:6px;font-size:.8rem' }, 'Toque em um dia para ver/editar o treino daquele dia.'),
  ));

  raiz.append(h('div', { class: 'card stats' },
    h('div', {}, h('b', { style: 'color:var(--verde)' }, foi), h('span', {}, 'dias que fui')),
    h('div', {}, h('b', { style: 'color:var(--vermelho)' }, naoFoi), h('span', {}, 'dias que faltei')),
    h('div', {}, h('b', {}, exFeitos), h('span', {}, 'exercícios feitos')),
  ));

  // Histórico do mês
  const dias = Object.keys(estado.registros).filter(d => d.startsWith(ui.mesCal)).sort().reverse();
  if (dias.length) {
    raiz.append(h('h2', {}, 'Histórico do mês'));
    raiz.append(h('div', { class: 'card' }, dias.map(d => {
      const r = estado.registros[d];
      const ficha = r.fichaId && fichaPorId(r.fichaId);
      const itens = Object.values(r.ex).filter(e => e.feito || e.series);
      const status = r.presenca === 'sim' ? '✅' : r.presenca === 'nao' ? '❌' : '•';
      return h('div', { class: 'hist-item' },
        h('b', {}, `${status} ${fmtData(d)}`), ficha ? ` — ${ficha.nome}` : '',
        itens.length > 0 && h('div', { class: 'ex-meta' },
          itens.map(e => `${e.feito ? '✓' : '◐'} ${e.nome}${e.carga ? ` (${e.carga} kg)` : ''}`).join(' · ')),
      );
    })));
  }
}

const abreviar = nome => { const m = nome.match(/\b([A-Z0-9])\s*$/i); return m ? m[1].toUpperCase() : nome.slice(0, 3); };

/* =====================================================================
   TEMPORIZADOR DE DESCANSO
   ===================================================================== */

const Timer = (() => {
  const elRaiz = document.getElementById('timer');
  const elDisplay = document.getElementById('timer-display');
  let total = estado.intervalo || 30;
  let restante = total;
  let fim = null;        // timestamp de término (se rodando)
  let intervalo = null;
  let audio = null;

  const rodando = () => fim !== null;

  function desenhar() {
    elDisplay.textContent = fmtTempo(restante);
    elRaiz.classList.toggle('rodando', rodando());
    document.title = rodando() ? `⏱ ${fmtTempo(restante)} — Meu Treino` : 'Meu Treino';
  }

  function prepararAudio() {
    try { audio ||= new (window.AudioContext || window.webkitAudioContext)(); audio.resume?.(); } catch (e) { /* sem áudio */ }
  }

  function bipe() {
    if (navigator.vibrate) navigator.vibrate([300, 150, 300, 150, 500]);
    if (!audio) return;
    const t0 = audio.currentTime;
    [0, 0.35, 0.7].forEach((d, i) => {
      const o = audio.createOscillator(), g = audio.createGain();
      o.frequency.value = i === 2 ? 1320 : 880;
      g.gain.setValueAtTime(0.0001, t0 + d);
      g.gain.exponentialRampToValueAtTime(0.5, t0 + d + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + d + 0.28);
      o.connect(g).connect(audio.destination);
      o.start(t0 + d); o.stop(t0 + d + 0.3);
    });
  }

  function tick() {
    const r = Math.ceil((fim - Date.now()) / 1000);
    if (r <= 0) {
      parar(); restante = total; desenhar();
      bipe();
      elRaiz.classList.add('alarme');
      setTimeout(() => elRaiz.classList.remove('alarme'), 2500);
      return;
    }
    if (r !== restante) { restante = r; desenhar(); }
  }

  function iniciar() {
    if (rodando()) return;
    prepararAudio();
    elRaiz.classList.remove('alarme');
    fim = Date.now() + restante * 1000;
    intervalo = setInterval(tick, 200);
    desenhar();
  }

  function parar() {
    if (rodando()) restante = Math.max(0, Math.ceil((fim - Date.now()) / 1000));
    fim = null;
    clearInterval(intervalo);
  }

  function ajustar(delta) {
    const novo = Math.max(MIN_TIMER, Math.min(MAX_TIMER, total + delta));
    const dif = novo - total;
    total = novo;
    estado.intervalo = total; salvar();
    if (rodando()) { fim += dif * 1000; if (fim <= Date.now()) fim = Date.now() + 1000; tick(); }
    else restante = total;
    desenhar();
  }

  elRaiz.addEventListener('click', e => {
    const acao = e.target.closest('[data-acao]')?.dataset.acao;
    if (acao === 'toggle') { rodando() ? (parar(), desenhar()) : iniciar(); }
    else if (acao === 'mais') ajustar(PASSO_TIMER);
    else if (acao === 'menos') ajustar(-PASSO_TIMER);
    else if (acao === 'reset') { parar(); restante = total; elRaiz.classList.remove('alarme'); desenhar(); }
  });

  // Ao voltar para o app (tela desligada etc.), atualiza na hora.
  document.addEventListener('visibilitychange', () => { if (rodando()) tick(); });

  desenhar();

  return {
    reiniciarEIniciar() { parar(); restante = total; iniciar(); },
    definir(s) { parar(); total = restante = s; desenhar(); },
  };
})();

/* =====================================================================
   Navegação e inicialização
   ===================================================================== */

const renderizadores = { hoje: renderHoje, fichas: renderFichas, calendario: renderCalendario };

function trocarAba(aba) {
  ui.aba = aba;
  document.querySelectorAll('.aba').forEach(s => s.classList.toggle('ativa', s.id === 'aba-' + aba));
  document.querySelectorAll('.abas button').forEach(b => b.classList.toggle('ativa', b.dataset.aba === aba));
  renderizadores[aba]();
  window.scrollTo(0, 0);
}

function renderTudo() { renderizadores[ui.aba](); }

document.querySelectorAll('.abas button').forEach(b => b.addEventListener('click', () => trocarAba(b.dataset.aba)));

// Se o app ficou aberto de um dia para o outro, volta para "hoje".
let ultimoDia = hojeISO();
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && hojeISO() !== ultimoDia) {
    if (ui.data === ultimoDia) ui.data = hojeISO();
    ultimoDia = hojeISO();
    renderTudo();
  }
});

trocarAba('hoje');

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
