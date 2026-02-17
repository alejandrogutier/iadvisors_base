const normalizeText = (value = '') =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const createGuideMap = (entries) => new Map(entries.map(([key, value]) => [normalizeText(key), value]));

const formatGuideMap = createGuideMap([
  [
    'Página home',
    'Landing principal del sitio: presenta la propuesta de valor, prueba social y uno o dos CTA claros que guíen al siguiente paso.'
  ],
  [
    'Página producto',
    'Página enfocada en un producto/servicio. Explica el problema, beneficios, diferenciadores, especificaciones y CTA enfocado en conversión.'
  ],
  [
    'Página de contenido con insumo',
    'Artículo o sección editorial que parte de materiales existentes. Reorganiza, corrige tono y cita las fuentes relevantes.'
  ],
  [
    'Página de contenido sin insumo',
    'Contenido generado desde cero. Investiga lo indispensable, estructura el texto y sugiere referencias confiables.'
  ],
  [
    'Página tipo blog',
    'Formato editorial SEO. Introduce el tema, desarrolla subtítulos informativos, ejemplos y cierra con CTA a recursos adicionales.'
  ],
  [
    'Página contenido paso a paso',
    'Guía instructiva. Lista pasos numerados, detalla qué hacer en cada uno y agrega tips o advertencias.'
  ],
  [
    'Menú de navegación',
    'Define estructura y microcopys para navegación principal y secundaria, cuidando jerarquía y claridad en desktop y mobile.'
  ],
  [
    'Formulario',
    'Pantalla de captura de datos. Incluye títulos, instrucciones, placeholders, validaciones y mensajes de error que transmitan confianza.'
  ],
  [
    'Buscador',
    'Módulo de búsqueda: título, placeholder, microcopys y mensajes para resultados vacíos que orienten al usuario.'
  ],
  [
    'Imágenes',
    'Requerimientos de activos visuales: describe el recurso, naming y texto alternativo accesible.'
  ],
  [
    'Artículos help',
    'Contenido de centro de ayuda/FAQ. Explica procesos paso a paso, agrega tips, links de soporte y versiones multilingüe si aplica.'
  ],
  [
    'Landing informativa',
    'Landing orientada a informar: héroe, storytelling corto, datos soportados, bullets y CTA únicos.'
  ],
  ['Mejoras de contenido', 'Revisión integral de copys existentes para alinear tono, claridad y exactitud.'],
  [
    'ECARD',
    'Tarjeta o correo digital: asunto, preheader, hero, cuerpo breve, CTA y variantes multilenguaje/multicanal.'
  ],
  ['WEB  - HOME', 'Variante web de la home: mismos requisitos de jerarquía visual y CTA que la home principal.'],
  ['WEB  - LANDING', 'Landing web de campaña. Reforzar promesa, prueba social y CTA único con urgencia moderada.'],
  ['Mails', 'Pieza de email marketing o transaccional, optimizada para deliverability (asunto, preheader, cuerpo modular, CTA).'],
  ['Pagina formulario y dinámica', 'Página para una dinámica con formulario: explica mecánica, pasos y condiciones legales.'],
  ['Pagina blog', 'Artículo estilo blog enfocado en educación y posicionamiento de expertise.'],
  ['Newsletter', 'Boletín recurrente con módulos (hero, notas destacadas, CTA secundarios) y tono informativo.'],
  ['Post estático', 'Pieza social de imagen fija: copy directo, beneficio en primera línea y CTA verbal + visual.'],
  ['Post', 'Publicación social genérica lista para adaptar al canal.'],
  ['Publicación', 'Post social con copy flexible para redes indicadas.'],
  ['Video/reel', 'Video vertical 9:16. Hook en <3s, storytelling ágil y CTA verbal/escrito.'],
  ['Reel', 'Reel con ritmo alto, subtítulos on-screen y cierre claro.'],
  ['Storys', 'Secuencia de stories verticales con narrativa por frame e interacción.'],
  ['Story', 'Story individual o serie corta enfocada en interacción rápida.'],
  ['Historias', 'Stories para comunicar beneficios con recursos interactivos.'],
  ['Carrusel', 'Carrusel multi-card: cada slide debe tener título, beneficio y CTA que incentive deslizar.'],
  ['Videos Truview', 'Video TrueView en YouTube: menciona marca en <5 segundos, storytelling escalonado y cierre fuerte.'],
  ['Banner display', 'Creatividad display/responsive: titular conciso, subcopy puntual y CTA contrastante.'],
  ['Banner Bumper', 'Bumper ad (≈6s). Un mensaje, un beneficio y repetición de marca.']
]);

const channelGuideMap = createGuideMap([
  [
    'Facebook',
    'Tono cercano y empático, copy de 2-3 frases y hasta 3 hashtags relevantes. Coloca el CTA y enlace dentro del texto.'
  ],
  [
    'Instagram',
    'Visual-first: ganchos iniciales, saltos de línea, 3-5 hashtags curados y menciones a cuentas clave.'
  ],
  [
    'Facebook e Instagram',
    'Debe funcionar en ambas redes ajustando hashtags, longitud del caption y recursos visuales sin perder consistencia.'
  ],
  ['Twitter', 'Formato X/Twitter: máximo 280 caracteres incluyendo hashtags, menciones y enlaces. Mensaje directo y actual.'],
  [
    'Linked In',
    'Entorno profesional/B2B. Prioriza datos concretos, credenciales y CTA a recursos que profundicen. Emojis solo si aportan claridad.'
  ],
  ['Youtube', 'Canal de video. Define hook inicial, estructura narrativa y CTA verbal + en descripción con keywords.'],
  ['Tik tok', 'Video corto vertical con ritmo ágil, uso de tendencias, subtítulos on-screen y CTA implícito en la interacción.'],
  ['Tiktok', 'Variante TikTok: creatividad auténtica, dinámica y enfocada en retención inmediata.'],
  ['Web', 'Ubicaciones web/display: mensajes contundentes, jerarquía visual clara y CTA contrastante.']
]);

const includesAny = (text, terms) => terms.some((term) => text.includes(term));

const hasToken = (text, token) => ` ${text} `.includes(` ${token} `);

const stripLanguageTag = (label = '') =>
  label
    .replace(/^\s*\*/g, '')
    .replace(/-\s*Traducci[oó]n.*$/gi, '')
    .replace(/-\s*(EN|PT)\s*$/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

const cleanReference = (label = '') => label.replace(/^\s*\*/g, '').trim();

const defaultElementDescription = (label) =>
  `Desarrolla "${label}" con claridad, datos relevantes y foco en la necesidad del usuario.`;

export const getFormatDescription = (name = '') => formatGuideMap.get(normalizeText(name)) || '';

export const getChannelDescription = (name = '') => channelGuideMap.get(normalizeText(name)) || '';

export const describeElement = (label = '') => {
  if (!label) return '';
  const normalized = normalizeText(label);
  if (!normalized) return '';
  const baseLabel = stripLanguageTag(label);
  const baseNormalized = normalizeText(baseLabel) || normalized;

  const needsEnglish = normalized.includes('traduccion en') || hasToken(normalized, 'en');
  const needsPortuguese = normalized.includes('traduccion pt') || hasToken(normalized, 'pt');

  if (normalized.includes('traduccion') || needsEnglish || needsPortuguese) {
    const targetLanguage = needsPortuguese ? 'portugués' : 'inglés';
    const referenceRaw = baseLabel || cleanReference(label);
    const subject = referenceRaw ? `"${referenceRaw}"` : 'este elemento';
    return `Traduce ${subject} al ${targetLanguage} conservando intención, beneficio clave y tono Bayer, adaptando localismos y signos de puntuación.`;
  }

  if (
    includesAny(baseNormalized, [
      'ajuste de tono',
      'revision tono',
      'revision de tono',
      'correccion',
      'simplificacion',
      'correccion redaccion'
    ])
  ) {
    return 'Revisa y optimiza el texto para asegurar coherencia con la voz cercana, científica y empática de Bayer.';
  }

  if (includesAny(baseNormalized, ['naming de secciones'])) {
    return 'Propón nombres cortos y memorables para cada sección, alineados a la arquitectura de información y tono Bayer.';
  }

  if (baseNormalized === 'name') {
    return 'Define un nombre corto y descriptivo para el archivo o recurso visual, evitando caracteres especiales.';
  }

  if (includesAny(baseNormalized, ['h1'])) {
    return 'Título principal con beneficio clave y palabra clave relevante, máximo 8-10 palabras y un verbo de acción.';
  }

  if (includesAny(baseNormalized, ['h2'])) {
    return 'Subtítulo jerárquico que amplíe el H1. Mantén 10-12 palabras y resalta el siguiente valor para el lector.';
  }

  if (includesAny(baseNormalized, ['h3'])) {
    return 'Subtítulo de apoyo para dividir secciones internas. Sé específico y usa hasta 8 palabras.';
  }

  if (includesAny(baseNormalized, ['h4'])) {
    return 'Etiqueta corta (3-5 palabras) que ayude a escanear bloques secundarios o listas.';
  }

  if (includesAny(baseNormalized, ['titulo banner'])) {
    return 'Encabezado del hero/creatividad: 4-6 palabras con promesa potente y tono inspirador.';
  }

  if (includesAny(baseNormalized, ['titulo cuerpo'])) {
    return 'Título para el cuerpo del mensaje. Introduce la sección con un beneficio claro y lenguaje directo.';
  }

  if (includesAny(baseNormalized, ['titulo']) && !includesAny(baseNormalized, ['banner', 'cuerpo'])) {
    return 'Escribe un título conciso y memorable que anticipe el contenido del bloque.';
  }

  if (
    includesAny(baseNormalized, ['descripcion de producto', 'descripciones de producto', 'descipcion de productos'])
  ) {
    return 'Describe el producto: problema que resuelve, características clave, beneficios medibles y evidencia de soporte.';
  }

  if (
    includesAny(baseNormalized, ['descripcion', 'descripciones', 'descipciones', 'decripcion', 'descricion'])
  ) {
    return 'Redacta un párrafo descriptivo de 2-3 frases resaltando beneficios tangibles y mensajes clave.';
  }

  if (includesAny(baseNormalized, ['beneficios'])) {
    return 'Lista de beneficios concretos (bullets cortos) conectados a insights del usuario y prueba social cuando exista.';
  }

  if (includesAny(baseNormalized, ['cuerpo', 'body'])) {
    return 'Desarrolla el cuerpo del texto con storytelling breve, datos de respaldo y un CTA al final del bloque.';
  }

  if (includesAny(baseNormalized, ['introduccion'])) {
    return 'Párrafo inicial que contextualiza el tema, engancha con un dato o pregunta y prepara el resto del contenido.';
  }

  if (includesAny(baseNormalized, ['cierre'])) {
    return 'Cierre inspirador con recap de valor y CTA explícito hacia la siguiente acción.';
  }

  if (includesAny(baseNormalized, ['call to action', 'cta'])) {
    return 'Copy del CTA: verbo imperativo, beneficio directo y máximo 4 palabras. Asegura consistencia con el destino.';
  }

  if (includesAny(baseNormalized, ['calle de salida', 'calles de salida'])) {
    return 'Frases de transición o salida que mantengan el interés si el usuario aún no decide. Ofrece alternativas o recursos extra.';
  }

  if (includesAny(baseNormalized, ['qa'])) {
    return 'Listado de preguntas frecuentes con respuestas breves (2-3 frases) que despejen objeciones comunes.';
  }

  if (includesAny(baseNormalized, ['investigacion', 'consulta de fuentes', 'inestigacion'])) {
    return 'Recopila hallazgos y fuentes confiables que respalden el contenido; incluye referencias o enlaces sugeridos.';
  }

  if (includesAny(baseNormalized, ['imagen', 'imagenes', 'imagenes sugeridas', 'imagen o video'])) {
    return 'Describe el recurso visual: escena, protagonistas, estilo, formato y mensaje clave a transmitir.';
  }

  if (includesAny(baseNormalized, ['alt'])) {
    return 'Texto alternativo accesible (máx. 120 caracteres) describiendo la imagen y su intención.';
  }

  if (includesAny(baseNormalized, ['copy de imagen'])) {
    return 'Texto sobre la imagen (overlay). Sé breve, legible y alude al beneficio principal.';
  }

  if (includesAny(baseNormalized, ['copy', 'copys']) && !includesAny(baseNormalized, ['copy de imagen'])) {
    return 'Microcopy o frase breve alineada al objetivo del bloque, con tono claro y orientado a acción.';
  }

  if (includesAny(baseNormalized, ['copys destacados'])) {
    return 'Bullets destacados de máximo 8 palabras cada uno, enfatizando datos o beneficios clave.';
  }

  if (includesAny(baseNormalized, ['copys para destinos'])) {
    return 'Copy específico para cada destino/plataforma, adaptando CTA y métricas para cada URL.';
  }

  if (includesAny(baseNormalized, ['claim'])) {
    return 'Statement breve que resalte la característica diferenciadora del producto con lenguaje aspiracional.';
  }

  if (includesAny(baseNormalized, ['mensaje para whatsapp'])) {
    return 'Mensaje corto para WhatsApp: saludo, beneficio, instrucción concreta y CTA con tono conversacional.';
  }

  if (includesAny(baseNormalized, ['pre header', 'preheader'])) {
    return 'Texto preheader (35-70 caracteres) que complemente el asunto y anticipe el beneficio.';
  }

  if (includesAny(baseNormalized, ['asunto'])) {
    return 'Asunto de email (máx. 45 caracteres) con verbo de acción, urgencia moderada y sin palabras spam.';
  }

  if (includesAny(baseNormalized, ['header'])) {
    return 'Mensaje principal del hero (encabezado visual) que sintetice la oferta en 4-7 palabras.';
  }

  if (includesAny(baseNormalized, ['texto informativo'])) {
    return 'Texto auxiliar que explica cómo completar un campo o proceso; tono directo y empático.';
  }

  if (includesAny(baseNormalized, ['place holder'])) {
    return 'Placeholder para campos del formulario. Usa ejemplos concretos y máximo 4 palabras.';
  }

  if (includesAny(baseNormalized, ['segmento'])) {
    return 'Describe el segmento objetivo (dolores, motivaciones, contexto) para personalizar el mensaje.';
  }

  if (includesAny(baseNormalized, ['objetivo y tematica', 'objetivo', 'tematica'])) {
    return 'Define el objetivo de comunicación y la temática central con claridad para guiar la respuesta del asistente.';
  }

  if (includesAny(baseNormalized, ['tarifa'])) {
    return 'Indica tarifas/precios, moneda y condiciones comerciales relevantes (periodicidad, impuestos, descuentos).';
  }

  if (includesAny(baseNormalized, ['utm'])) {
    return 'Construye parámetros UTM (source, medium, campaign, content) alineados al destino digital.';
  }

  if (includesAny(baseNormalized, ['enlace', 'enlaces'])) {
    return 'Lista los enlaces finales con el CTA asociado y breve descripción del destino.';
  }

  if (includesAny(baseNormalized, ['mencion', 'menciones'])) {
    return 'Identifica las cuentas/perfiles que se deben etiquetar en la pieza y cómo mencionarlos.';
  }

  if (includesAny(baseNormalized, ['hashtag', 'hasthtag', 'hashtags'])) {
    return 'Sugiere 3-6 hashtags relevantes (mezcla de alcance y nicho) en español/inglés según convenga.';
  }

  if (includesAny(baseNormalized, ['caption'])) {
    return 'Caption principal para la publicación: hook, beneficio, CTA y hashtags/menciones al final.';
  }

  if (includesAny(baseNormalized, ['280 caracteres'])) {
    return 'Texto tipo tweet (máx. 280 caracteres con hashtags/menciones). Mensaje directo y accionable.';
  }

  if (includesAny(baseNormalized, ['10 palabras por frame'])) {
    return 'Redacta copys de hasta 10 palabras por frame, manteniendo coherencia narrativa y CTA final.';
  }

  if (includesAny(baseNormalized, ['maximo 3 frames', 'maximo 4 frames'])) {
    return 'Guioniza cada frame enumerado (1,2,3,…) con CTA o interacción clara.';
  }

  if (includesAny(baseNormalized, ['frame'])) {
    return 'Define el mensaje por frame, indicando visual sugerido y copy breve.';
  }

  if (includesAny(baseNormalized, ['emoji', 'emojis'])) {
    return 'Lista de emojis sugeridos (máx. 3) para reforzar tono sin saturar.';
  }

  if (includesAny(baseNormalized, ['interaccion', 'sticker'])) {
    return 'Propón stickers o dinámicas interactivas (poll, slider, preguntas) que incentiven participación.';
  }

  if (includesAny(baseNormalized, ['perfilador', 'encuesta', 'dinamica'])) {
    return 'Diseña preguntas o prompts interactivos para perfilar al usuario y conseguir respuesta rápida.';
  }

  if (includesAny(baseNormalized, ['guion', 'dialog'])) {
    return 'Escribe guion dialogado indicando personaje, línea y acción visual por escena.';
  }

  if (includesAny(baseNormalized, ['categorias'])) {
    return 'Define categorías/etiquetas temáticas que organizan el contenido y facilitan filtrado.';
  }

  if (includesAny(baseNormalized, ['wording'])) {
    return 'Redacción base del mensaje con tono alineado a Bayer y foco en claridad.';
  }

  return defaultElementDescription(baseLabel || label);
};
