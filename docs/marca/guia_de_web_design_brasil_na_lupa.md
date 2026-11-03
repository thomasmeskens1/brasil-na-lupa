# Diretrizes Técnicas de Web Design: Brasil na Lupa

Este documento serve como a especificação de UI/UX e Frontend para o desenvolvimento do site **Brasil na Lupa**. O objetivo é orientar agentes de desenvolvimento de software e designers na implementação de uma interface visualmente impactante, de alta conversão, responsiva e focada na linguagem das mídias sociais.

---

## 1. Conceito e Arquitetura Visual (Design System)

* **Estilo Visual:** Dark Mode nativo com alto contraste neon (*Tech-Media* / *GovTech Pop*).
* **Foco da Interface:** Leitura ultra-rápida, cards interativos, tipografia pesada e elementos que imitam stickers/redes sociais.
* **Layout:** Mobile-First. Priorizar visualização em telas de smartphones (390px - 430px) e escalar de forma fluida para desktop.

---

## 2. Tokens de Design (Variáveis CSS)

Copie e cole este bloco de variáveis no início da sua folha de estilos (`global.css` ou `:root`):

```css
:root {
  /* Cores Principais */
  --bg-dark: #121214;          /* Fundo principal da página */
  --bg-card: #1A1A1D;          /* Fundo de cards e modais */
  --bg-card-hover: #242429;    /* Estado hover dos cards */
  --border-subtle: #2A2A32;    /* Bordas discretas */

  /* Cores de Destaque / Ação */
  --accent-neon: #CCFF00;      /* Lime/Yellow Neon (Uso em botões, tags e destaques) */
  --accent-neon-hover: #b3e600;/* Hover para elementos neon */
  
  /* Cores de Texto */
  --text-primary: #FFFFFF;     /* Títulos e textos de alta prioridade */
  --text-secondary: #A0A0A5;   /* Subtítulos, metadados e textos longos */
  --text-dark: #121214;        /* Texto dentro de badges/botões neon */

  /* Status Políticos (Tags) */
  --status-approved: #22C55E;  /* Verde (Aprovado) */
  --status-rejected: #EF4444;  /* Vermelho (Rejeitado) */
  --status-pending: #F59E0B;   /* Amarelo/Laranja (Em Votação) */

  /* Tipografia */
  --font-heading: 'Poppins', sans-serif;
  --font-body: 'DM Sans', sans-serif;

  /* Efeitos */
  --shadow-neon: 0 0 20px rgba(204, 255, 0, 0.25);
  --radius-card: 16px;
  --radius-pill: 999px;
}
```

---

## 3. Tipografia & Importação de Fontes

Adicione o seguinte carregamento no `<head>` do seu HTML:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000&family=Poppins:ital,wght@0,700;0,800;0,900;1,800&display=swap" rel="stylesheet">
```

### Regras de Uso Tipográfico:
1. **Headings (H1, H2, H3):**
   * Font-family: `var(--font-heading)`
   * Font-weight: `800` ou `900`
   * Text-transform: `uppercase` (especialmente para manchetes virais e banners)
   * Letter-spacing: `-0.02em` (estilo condensado)
2. **Corpo de Texto & Resumos:**
   * Font-family: `var(--font-body)`
   * Font-weight: `400` ou `500`
   * Line-height: `1.6` para máxima legibilidade em dispositivos móveis.

---

## 4. Componentes UI Específicos

### A. Efeito Marca-Texto (Highlight Word)
Para aplicar o efeito visual característico da marca em termos-chave:

```html
<!-- Exemplo de uso -->
<h2>PROJETO DE LEI <span class="highlight-neon">APROVADO</span> HOJE</h2>
```

```css
.highlight-neon {
  background-color: var(--accent-neon);
  color: var(--text-dark);
  padding: 2px 8px;
  border-radius: 4px;
  display: inline-block;
  transform: rotate(-1deg); /* Leve inclinação dinâmica */
  font-weight: 900;
}
```

### B. Cards de Projetos de Lei (Feeds)
* **Background:** `var(--bg-card)`
* **Borda:** `1px solid var(--border-subtle)`
* **Border Radius:** `var(--radius-card)`
* **Hover:** Transição suave com elevation em `transform: translateY(-4px)` e brilho `var(--shadow-neon)`.

### C. Botões Principais (CTA)
* **Estilo:** Fundo `var(--accent-neon)`, texto `var(--text-dark)`, fonte `Poppins 800`.
* **Hover:** Efeito de escala suave (`scale(1.03)`) + `box-shadow: var(--shadow-neon)`.

---

## 5. Estrutura de Layout Sugerida (Hero & Navbar)

1. **Header / Navbar:** 
   * Fundo escuro semi-transparente com `backdrop-filter: blur(10px)`.
   * Logo alinhado à esquerda e botão de busca / lupa em neon à direita.
2. **Hero Section (Acima da Dobra):**
   * Título principal em tamanho Extra Large (`Poppins 900`).
   * Frase provocativa: *"O QUE ESTÃO VOTANDO AGORA E COMO ISSO AFETA SEU BOLSO."*
   * Carrossel ou grade de destaques com visual estilo "Stories" ou "Reels".
3. **Seção de Busca Rápida:**
   * Campo de busca destacado com borda neon e ícone da Lupa.

---

## 6. Orientações para o Agente de IA / Desenvolvedor

* **Manter o Dark Mode NATIVO:** Não criar alternância para light mode sem autorização; a identidade da marca depende do contraste escuro.
* **Ícones e Assets:** Utilize arquivos SVG para os logos e ícones. Em caso de necessidade de ilustrações adicionais, utilize estilos com traços espessos (*bold stroke*) ou vetores estilo *sticker*.
* **Micro-interações:** Toda votação (curti/não curti) ou compartilhamento deve ter respostas visuais instantâneas com animações curtas em CSS.