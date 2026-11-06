# 🏋️ Meu Treino

App pessoal (PWA) para acompanhar a ficha de treino da academia. Funciona no navegador do celular, pode ser instalado na tela inicial e funciona offline. **Não tem servidor nem login**: os dados ficam salvos no próprio aparelho.

## Funcionalidades

| Objetivo | Onde fica |
|---|---|
| **a)** Registrar a ficha de treino | Aba **Fichas**: crie fichas (Treino A, B, C…) e adicione exercícios com séries, repetições e carga. Dá para reordenar, editar e excluir. |
| **b)** Link para vídeo de execução | Ao cadastrar o exercício, cole o link (YouTube, Instagram…). O nome do exercício vira link. Sem link, o app abre uma busca no YouTube pelo nome. |
| **c)** Número de repetições | Campo **Repetições** (aceita `12` ou `8-12`), editável na ficha e no treino do dia. |
| **d)** Carga de cada exercício | Campo **Carga hoje (kg)** em cada exercício. O app guarda o histórico e mostra a **última carga usada** e a data. |
| **e)** Temporizador de descanso | Barra fixa embaixo: começa em **0:30**, botões **−15 / +15** (mín. 15s, máx. 10min). Toque no relógio para iniciar/pausar, ↺ para zerar. Ao tocar no botão de uma série (1ª, 2ª…), o descanso começa sozinho. Toca bipe e vibra ao terminar. O intervalo escolhido fica salvo. |
| **f)** Gabarito | Na aba **Treino**: botões **✅ Fui / ❌ Não fui** e a marcação de cada exercício (✓). Na aba **Gabarito**: calendário mensal (verde = fui, vermelho = não fui), contagem de dias e histórico do mês com cargas. Marcar um exercício já marca o dia como "fui". |

Extras: sugere automaticamente a próxima ficha da sequência (A → B → C…), permite navegar para dias anteriores e fazer **backup** (exportar/importar arquivo `.json`) na aba Fichas.

## Como usar

### Opção 1 — GitHub Pages (recomendado para usar no celular)
1. No GitHub: **Settings → Pages → Source: Deploy from a branch**, escolha a branch e a pasta `/ (root)`.
2. Abra o endereço gerado (`https://<usuario>.github.io/<repositorio>/`) no celular.
3. Instale na tela inicial:
   - **Android (Chrome):** menu ⋮ → *Adicionar à tela inicial* / *Instalar app*.
   - **iPhone (Safari):** botão Compartilhar → *Adicionar à Tela de Início*.

> Observação: GitHub Pages em repositório privado exige plano pago do GitHub. Com repositório público, o código fica visível, mas **seus dados de treino não** — eles ficam só no seu aparelho.

### Opção 2 — Local no computador
```bash
python3 -m http.server 8000
```
e abra `http://localhost:8000`.

## Importante sobre os dados
- Ficam no armazenamento do navegador (localStorage) do aparelho onde você usa.
- Limpar os dados do navegador apaga o histórico → use **Exportar** de vez em quando.
- Para passar para outro aparelho: Exportar em um, Importar no outro.

## Estrutura
```
index.html            página principal
style.css             visual (tema escuro, mobile-first)
app.js                toda a lógica (fichas, treino do dia, temporizador, gabarito)
sw.js                 service worker (uso offline)
manifest.webmanifest  configuração de instalação (PWA)
icons/                ícones do app
```
