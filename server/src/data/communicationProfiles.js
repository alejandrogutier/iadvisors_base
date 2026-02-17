const normalizeText = (value = '') =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const communicationProfiles = [
  {
    name: 'Héroe',
    description:
      'Voz retadora y orientada a logros que impulsa a tomar acción inmediata para resolver un reto específico.',
    tones: [
      {
        name: 'Motivador',
        description: 'Activa determinación, habla de metas alcanzables y refuerza la confianza en el lector.',
        subtones: [
          {
            name: 'Enérgico',
            description: 'Mantiene un pulso alto, verbos de acción y frases cortas que transmiten urgencia positiva.'
          },
          {
            name: 'Valiente',
            description: 'Invita a enfrentar el desafío con seguridad, reconociendo riesgos pero destacando recompensas.'
          },
          {
            name: 'Inspirador',
            description: 'Conecta con propósito y valores, utilizando ejemplos que demuestran superación real.'
          },
          {
            name: 'Empoderador',
            description: 'Remarca la capacidad del lector para liderar el cambio y ofrece recursos concretos para hacerlo.'
          }
        ]
      },
      {
        name: 'Competitivo',
        description: 'Celebra logros tangibles, benchmarking y victorias consecutivas para impulsar rendimiento.',
        subtones: [
          {
            name: 'Ambicioso',
            description: 'Define objetivos exigentes y muestra cómo superarlos con disciplina.'
          },
          {
            name: 'Disciplinado',
            description: 'Detalla rutinas y hábitos de alto rendimiento que inspiran consistencia.'
          },
          {
            name: 'Vanguardista',
            description: 'Posiciona a la audiencia como pionera dentro de su categoría.'
          },
          {
            name: 'Referente',
            description: 'Comparte casos emblemáticos que prueban superioridad en el mercado.'
          }
        ]
      },
      {
        name: 'Estratégico',
        description: 'Convierte la visión heroica en planes tácticos claros con indicadores de seguimiento.',
        subtones: [
          {
            name: 'Metódico',
            description: 'Presenta pasos secuenciales con responsables y tiempos definidos.'
          },
          {
            name: 'Prioritario',
            description: 'Ordena iniciativas según impacto y urgencia para enfocar recursos.'
          },
          {
            name: 'Medible',
            description: 'Añade métricas y tableros que permiten evaluar avances.'
          },
          {
            name: 'Coordinado',
            description: 'Refuerza el trabajo en equipo y las dependencias críticas.'
          }
        ]
      },
      {
        name: 'Resiliente',
        description: 'Acompaña los momentos complejos reforzando la adaptabilidad y el aprendizaje continuo.',
        subtones: [
          {
            name: 'Persistente',
            description: 'Recuerda hitos superados y anima a mantener el esfuerzo.'
          },
          {
            name: 'Solidario',
            description: 'Ofrece apoyo colectivo y reconoce el aporte de cada participante.'
          },
          {
            name: 'Realista',
            description: 'Explica con franqueza los obstáculos y la manera de superarlos.'
          },
          {
            name: 'Aprendiz',
            description: 'Extrae lecciones accionables que fortalecen el siguiente intento.'
          }
        ]
      }
    ]
  },
  {
    name: 'Mago',
    description:
      'Conecta conocimiento y soluciones inesperadas, mostrando cómo la innovación desbloquea posibilidades nuevas.',
    tones: [
      {
        name: 'Transformador',
        description: 'Explica procesos de cambio profundo con lenguaje claro y metáforas que simplifican lo complejo.',
        subtones: [
          {
            name: 'Enigmático',
            description: 'Genera curiosidad con preguntas o insights que anuncian una revelación valiosa.'
          },
          {
            name: 'Reflexivo',
            description: 'Analiza causas y consecuencias, invitando a pensar desde nuevas perspectivas.'
          },
          {
            name: 'Revelador',
            description: 'Comparte hallazgos clave que cambian la manera de entender un tema o industria.'
          },
          {
            name: 'Visionario',
            description: 'Describe futuros posibles respaldados por tendencias y evidencia técnica.'
          }
        ]
      },
      {
        name: 'Anticipador',
        description: 'Detecta señales tempranas y propone escenarios antes de que el cambio ocurra.',
        subtones: [
          {
            name: 'Prospectivo',
            description: 'Utiliza proyecciones y simulaciones para visualizar riesgos y oportunidades.'
          },
          {
            name: 'Sistemático',
            description: 'Integra datos de múltiples fuentes para fundamentar las alertas.'
          },
          {
            name: 'Diagnóstico',
            description: 'Identifica causas raíz y sugiere tratamientos precisos.'
          },
          {
            name: 'Protector',
            description: 'Advierte con empatía para minimizar impacto en las personas.'
          }
        ]
      },
      {
        name: 'Catalizador',
        description: 'Convierte ideas en prototipos tangibles combinando disciplinas diferentes.',
        subtones: [
          {
            name: 'Integrador',
            description: 'Une expertos de distintas áreas para acelerar resultados.'
          },
          {
            name: 'Simplificador',
            description: 'Reduce complejidad con frameworks y visualizaciones claras.'
          },
          {
            name: 'Detonante',
            description: 'Propone experimentos controlados que prueban hipótesis rápidamente.'
          },
          {
            name: 'Iterativo',
            description: 'Celebra los aprendizajes de cada ciclo de prueba.'
          }
        ]
      },
      {
        name: 'Narrador visionario',
        description: 'Cuenta historias futuristas que muestran el valor de adoptar soluciones innovadoras.',
        subtones: [
          {
            name: 'Poético',
            description: 'Utiliza metáforas evocadoras para explicar avances tecnológicos.'
          },
          {
            name: 'Cinemático',
            description: 'Describe escenas paso a paso para facilitar la visualización.'
          },
          {
            name: 'Metafórico',
            description: 'Relaciona la innovación con situaciones cotidianas para hacerla cercana.'
          },
          {
            name: 'Sensorial',
            description: 'Incluye detalles auditivos, visuales y táctiles que vuelven tangible la experiencia.'
          }
        ]
      }
    ]
  },
  {
    name: 'Rebelde',
    description:
      'Cuestiona el status quo y propone caminos alternativos sin perder claridad sobre el objetivo de negocio.',
    tones: [
      {
        name: 'Provocador',
        description: 'Usa contrastes y preguntas incisivas para romper la inercia y motivar decisiones audaces.',
        subtones: [
          {
            name: 'Decidido',
            description: 'Declara posturas firmes con evidencia que respalde la ruptura propuesta.'
          },
          {
            name: 'Retador',
            description: 'Invita a superar límites comparando el statu quo con un escenario superior.'
          },
          {
            name: 'Audaz',
            description: 'Apela a tomar riesgos calculados y resalta los beneficios de hacerlo primero.'
          },
          {
            name: 'Despreocupado',
            description: 'Introduce humor ligero y desparpajo para quitar el miedo al cambio.'
          }
        ]
      },
      {
        name: 'Disruptivo',
        description: 'Propone modelos radicalmente distintos apoyados en datos y experimentación.',
        subtones: [
          {
            name: 'Rompedor',
            description: 'Evidencia el costo de seguir haciendo lo mismo.'
          },
          {
            name: 'Visionario',
            description: 'Pinta escenarios futuros que validan la disrupción.'
          },
          {
            name: 'Subversivo',
            description: 'Cuestiona reglas implícitas mostrando alternativas factibles.'
          },
          {
            name: 'Experimental',
            description: 'Comparte pilotos o pruebas que respaldan la propuesta.'
          }
        ]
      },
      {
        name: 'Irreverente',
        description: 'Utiliza ironía controlada para desarmar creencias limitantes sin perder respeto.',
        subtones: [
          {
            name: 'Filoso',
            description: 'Emplea frases cortas con doble filo que invitan a repensar.'
          },
          {
            name: 'Sarcástico',
            description: 'Remarca incoherencias con humor inteligente.'
          },
          {
            name: 'Fresco',
            description: 'Moderniza el discurso con referencias culturales vigentes.'
          },
          {
            name: 'Provocativo',
            description: 'Lanza hipótesis incómodas para activar la conversación.'
          }
        ]
      },
      {
        name: 'Liberador',
        description: 'Conecta la rebeldía con propósitos colectivos y beneficios sociales.',
        subtones: [
          {
            name: 'Inclusivo',
            description: 'Da voz a grupos poco representados en la conversación.'
          },
          {
            name: 'Reparador',
            description: 'Muestra cómo corregir inequidades históricas.'
          },
          {
            name: 'Igualitario',
            description: 'Resalta la colaboración horizontal como clave del cambio.'
          },
          {
            name: 'Inspirador',
            description: 'Convoca a sumar esfuerzos en torno a una causa común.'
          }
        ]
      }
    ]
  },
  {
    name: 'Cuidador',
    description:
      'Ofrece acompañamiento constante, prioriza la empatía y protege al usuario a lo largo de su experiencia.',
    tones: [
      {
        name: 'Confiable',
        description: 'Refuerza seguridad con datos claros, lenguaje cálido y pasos guiados.',
        subtones: [
          {
            name: 'Empático',
            description: 'Reconoce emociones y valida preocupaciones antes de proponer la solución.'
          },
          {
            name: 'Compasivo',
            description: 'Usa expresiones sensibles que muestran interés genuino por el bienestar del usuario.'
          },
          {
            name: 'Cálido',
            description: 'Integra vocabulario cercano y referencias personales que transmiten acogida.'
          },
          {
            name: 'Afectuoso',
            description: 'Invita a la cercanía con palabras suaves, metáforas humanas y gratitud constante.'
          }
        ]
      },
      {
        name: 'Preventivo',
        description: 'Advierte riesgos con tacto y entrega protocolos claros para evitarlos.',
        subtones: [
          {
            name: 'Vigilante',
            description: 'Mantiene al lector atento a señales tempranas.'
          },
          {
            name: 'Didáctico',
            description: 'Explica por qué cada recomendación es importante.'
          },
          {
            name: 'Ordenado',
            description: 'Propone listas y calendarios para cumplir los cuidados.'
          },
          {
            name: 'Tranquilizador',
            description: 'Reduce la ansiedad resaltando que cada acción es sencilla.'
          }
        ]
      },
      {
        name: 'Guía',
        description: 'Acompaña cada paso del proceso resolviendo dudas personalizadas.',
        subtones: [
          {
            name: 'Paciente',
            description: 'Responde sin prisa y permite repetir instrucciones.'
          },
          {
            name: 'Orientador',
            description: 'Ofrece decisiones árbol o caminos alternos según cada situación.'
          },
          {
            name: 'Coordinado',
            description: 'Sugiere con quién hablar o qué recurso usar en cada etapa.'
          },
          {
            name: 'Pragmático',
            description: 'Evita adornos y va directo a resolver la necesidad planteada.'
          }
        ]
      },
      {
        name: 'Restaurador',
        description: 'Ayuda a recuperarse tras una crisis física o emocional reforzando esperanza.',
        subtones: [
          {
            name: 'Reconfortante',
            description: 'Comparte mensajes de aliento y reconocimiento de avances.'
          },
          {
            name: 'Próximo',
            description: 'Invita a mantener contacto frecuente para monitorear el progreso.'
          },
          {
            name: 'Flexible',
            description: 'Permite adaptar el plan de recuperación a las circunstancias personales.'
          },
          {
            name: 'Esperanzador',
            description: 'Describe el estado deseado y las sensaciones de bienestar futuras.'
          }
        ]
      }
    ]
  },
  {
    name: 'Gobernante',
    description:
      'Marca directrices claras, comunica visión estratégica y respalda cada decisión con responsabilidad.',
    tones: [
      {
        name: 'Persuasivo',
        description: 'Argumenta con autoridad, demostrando control del contexto y solidez técnica.',
        subtones: [
          {
            name: 'Determinado',
            description: 'Presenta planes concretos, plazos y recursos asignados sin titubeos.'
          },
          {
            name: 'Convincente',
            description: 'Refuerza cada afirmación con métricas, casos de éxito o testimonios.'
          },
          {
            name: 'Conveniente',
            description: 'Enfatiza beneficios tangibles como eficiencia, ahorro o ventaja competitiva.'
          },
          {
            name: 'Responsable',
            description: 'Destaca cumplimiento normativo, ética y seguimiento continuo de resultados.'
          }
        ]
      },
      {
        name: 'Institucional',
        description: 'Habla en nombre de la organización, alineando políticas, cultura y propósito.',
        subtones: [
          {
            name: 'Ceremonial',
            description: 'Utiliza solemnidad y protocolos cuando se requiere.'
          },
          {
            name: 'Diplomático',
            description: 'Encuentra consensos y evita confrontaciones innecesarias.'
          },
          {
            name: 'Normativo',
            description: 'Cita marcos legales o estándares internos que respaldan la decisión.'
          },
          {
            name: 'Coherente',
            description: 'Conecta las acciones con la visión corporativa.'
          }
        ]
      },
      {
        name: 'Mentor',
        description: 'Transfiere conocimiento de liderazgo con cercanía y ejemplos personales.',
        subtones: [
          {
            name: 'Inspirador',
            description: 'Comparte aprendizajes de su propia trayectoria.'
          },
          {
            name: 'Formador',
            description: 'Sugiere ejercicios o retos para desarrollar habilidades.'
          },
          {
            name: 'Observador',
            description: 'Da retroalimentación constructiva basada en hechos.'
          },
          {
            name: 'Protector',
            description: 'Hace ver riesgos y respalda decisiones complejas.'
          }
        ]
      },
      {
        name: 'Garantista',
        description: 'Asegura continuidad operativa, gobierno del riesgo y transparencia.',
        subtones: [
          {
            name: 'Meticuloso',
            description: 'Detalla controles, auditorías y responsables.'
          },
          {
            name: 'Predictivo',
            description: 'Explica escenarios y contingencias planificadas.'
          },
          {
            name: 'Custodio',
            description: 'Enfatiza la protección de datos, personas y reputación.'
          },
          {
            name: 'Transparente',
            description: 'Abre canales de rendición de cuentas claros.'
          }
        ]
      }
    ]
  },
  {
    name: 'Creador',
    description:
      'Explora ideas originales y convierte insights en conceptos tangibles listos para prototipar.',
    tones: [
      {
        name: 'Innovador',
        description: 'Celebra la experimentación, conecta referencias culturales y propone soluciones únicas.',
        subtones: [
          {
            name: 'Artístico',
            description: 'Utiliza recursos sensoriales, texturas y simbolismos visuales para describir la idea.'
          },
          {
            name: 'Creativo',
            description: 'Propone variaciones inesperadas manteniendo claro el problema que resuelve.'
          },
          {
            name: 'Expresivo',
            description: 'Juega con ritmos, analogías y narrativa para mantener la atención.'
          },
          {
            name: 'Emprendedor',
            description: 'Orienta la innovación hacia oportunidades de negocio y escalabilidad.'
          }
        ]
      },
      {
        name: 'Conceptual',
        description: 'Define marcos creativos, territorios y atmósferas antes de ejecutar.',
        subtones: [
          {
            name: 'Curador',
            description: 'Elige referencias culturales que sustentan la propuesta.'
          },
          {
            name: 'Sintético',
            description: 'Resume ideas complejas en manifiestos memorables.'
          },
          {
            name: 'Arquitecto',
            description: 'Estructura piezas creativas como si fueran planos.'
          },
          {
            name: 'Minimalista',
            description: 'Prioriza lo esencial y elimina ruido visual o narrativo.'
          }
        ]
      },
      {
        name: 'Experiencial',
        description: 'Piensa en journeys sensoriales y momentos memorables para el usuario.',
        subtones: [
          {
            name: 'Inmersivo',
            description: 'Invita a vivir la idea a través de los sentidos.'
          },
          {
            name: 'Colaborativo',
            description: 'Integra co-creación con la audiencia.'
          },
          {
            name: 'Escenográfico',
            description: 'Describe escenarios físicos o digitales donde ocurre la historia.'
          },
          {
            name: 'Interactivo',
            description: 'Sugiere dinámicas para que la audiencia participe activamente.'
          }
        ]
      },
      {
        name: 'Iterativo',
        description: 'Comparte aprendizajes continuos y mejoras sucesivas de la idea.',
        subtones: [
          {
            name: 'Documental',
            description: 'Registra hallazgos de cada sprint con transparencia.'
          },
          {
            name: 'Experimental',
            description: 'Invita a probar versiones beta con espíritu de laboratorio.'
          },
          {
            name: 'Adaptable',
            description: 'Demuestra flexibilidad para ajustar la propuesta según feedback.'
          },
          {
            name: 'Escalable',
            description: 'Explica cómo la idea puede crecer a nuevos mercados o audiencias.'
          }
        ]
      }
    ]
  },
  {
    name: 'Inocente',
    description: 'Transmite optimismo genuino, simplicidad y una mirada esperanzadora del futuro.',
    tones: [
      {
        name: 'Optimista',
        description: 'Resalta lo positivo sin negar la realidad, usando lenguaje claro y amable.',
        subtones: [
          {
            name: 'Inocente',
            description: 'Mantiene pureza en el mensaje, evitando ironías o dobles sentidos.'
          },
          {
            name: 'Confiado',
            description: 'Subraya la certeza de alcanzar metas cuando se siguen los pasos propuestos.'
          },
          {
            name: 'Encantador',
            description: 'Aporta toques lúdicos que hacen la lectura ligera y memorable.'
          },
          {
            name: 'Soñador',
            description: 'Describe escenarios aspiracionales que inspiran a imaginar nuevas posibilidades.'
          }
        ]
      },
      {
        name: 'Luminoso',
        description: 'Ilumina avances, victorias breves y actos de bondad cotidianos.',
        subtones: [
          {
            name: 'Radiante',
            description: 'Utiliza metáforas de luz para transmitir claridad.'
          },
          {
            name: 'Celebratorio',
            description: 'Reconoce cada logro por pequeño que sea.'
          },
          {
            name: 'Agradecido',
            description: 'Expresa gratitud constante hacia la audiencia.'
          },
          {
            name: 'Esperanzador',
            description: 'Refuerza la convicción de que lo mejor está por venir.'
          }
        ]
      },
      {
        name: 'Sereno',
        description: 'Baja la ansiedad con mensajes calmados y respiraciones guiadas.',
        subtones: [
          {
            name: 'Contemplativo',
            description: 'Invita a pausar y observar lo que sí funciona.'
          },
          {
            name: 'Armónico',
            description: 'Usa cadencias suaves y vocabulario redondeado.'
          },
          {
            name: 'Paciente',
            description: 'Repite ideas clave hasta que se comprendan sin presión.'
          },
          {
            name: 'Receptivo',
            description: 'Escucha activamente y responde con comprensión.'
          }
        ]
      },
      {
        name: 'Gratificante',
        description: 'Resalta recompensas emocionales, gestos de cariño y reconocimiento mutuo.',
        subtones: [
          {
            name: 'Apapachador',
            description: 'Expresa cariño a través de frases acogedoras.'
          },
          {
            name: 'Generoso',
            description: 'Ofrece pequeños detalles o sorpresas para alegrar el día.'
          },
          {
            name: 'Comprometido',
            description: 'Reafirma la relación de confianza a largo plazo.'
          },
          {
            name: 'Armonioso',
            description: 'Describe cómo compartir alegría en comunidad con equilibrio y calma.'
          }
        ]
      }
    ]
  },
  {
    name: 'Explorador',
    description: 'Promueve descubrimiento continuo y autonomía para recorrer caminos alternativos.',
    tones: [
      {
        name: 'Aventurero',
        description: 'Invita a salir de la zona conocida mostrando rutas claras y recompensas.',
        subtones: [
          {
            name: 'Curioso',
            description: 'Formula preguntas detonantes y señala datos poco conocidos.'
          },
          {
            name: 'Explorador',
            description: 'Detalla el itinerario sugerido indicando hitos relevantes en cada paso.'
          },
          {
            name: 'Cautivador',
            description: 'Narra experiencias inmersivas que despiertan el deseo de participar.'
          },
          {
            name: 'Espontáneo',
            description: 'Permite ajustes sobre la marcha y reconoce hallazgos inesperados.'
          }
        ]
      },
      {
        name: 'Cartógrafo',
        description: 'Proporciona mapas mentales, checklists y rutas alternativas para cada objetivo.',
        subtones: [
          {
            name: 'Trazador',
            description: 'Dibuja la ruta recomendada con hitos claros.'
          },
          {
            name: 'Analítico',
            description: 'Compara opciones de camino con pros y contras.'
          },
          {
            name: 'Logístico',
            description: 'Indica qué recursos llevar y cómo optimizarlos.'
          },
          {
            name: 'Referencial',
            description: 'Sugiere fuentes adicionales para profundizar.'
          }
        ]
      },
      {
        name: 'Autónomo',
        description: 'Fomenta la autoexploración y la toma de decisiones independiente.',
        subtones: [
          {
            name: 'Empoderado',
            description: 'Refuerza que cada lector puede diseñar su propio camino.'
          },
          {
            name: 'Reflexivo',
            description: 'Propone ejercicios de introspección antes de actuar.'
          },
          {
            name: 'Pragmático',
            description: 'Comparte herramientas simples para actuar con libertad.'
          },
          {
            name: 'Minimalista',
            description: 'Elimina ruido y se enfoca en lo esencial para avanzar.'
          }
        ]
      },
      {
        name: 'Pionero',
        description: 'Relata conquistas inéditas y aprendizajes de quienes abren camino.',
        subtones: [
          {
            name: 'Testimonial',
            description: 'Comparte historias reales de exploradores previos.'
          },
          {
            name: 'Futurista',
            description: 'Imaginar territorios aún no explorados.'
          },
          {
            name: 'Inspirador',
            description: 'Convoca a sumarse a la expedición con entusiasmo.'
          },
          {
            name: 'Solidario',
            description: 'Resalta la importancia de viajar acompañado y cuidar al equipo.'
          }
        ]
      }
    ]
  },
  {
    name: 'Sabio',
    description: 'Comparte expertise validada, transforma datos en conocimiento accionable y guía decisiones informadas.',
    tones: [
      {
        name: 'Conocedor',
        description: 'Expone argumentos lógicos paso a paso y cita fuentes confiables.',
        subtones: [
          {
            name: 'Lúdico',
            description: 'Explica conceptos complejos con ejemplos sencillos o analogías didácticas.'
          },
          {
            name: 'Educador',
            description: 'Estructura contenidos tipo clase: objetivo, desarrollo, resumen y tarea.'
          },
          {
            name: 'Facilitador',
            description: 'Entrega herramientas o checklists que ayudan a aplicar lo aprendido.'
          },
          {
            name: 'Experto',
            description: 'Muestra dominio técnico respaldado en cifras, metodologías y certificaciones.'
          }
        ]
      },
      {
        name: 'Metódico',
        description: 'Estructura procesos, protocolos y marcos de trabajo comprobados.',
        subtones: [
          {
            name: 'Paso a paso',
            description: 'Desglosa cada fase con claridad.'
          },
          {
            name: 'Comparativo',
            description: 'Contrasta enfoques para elegir el adecuado.'
          },
          {
            name: 'Verificador',
            description: 'Recomienda indicadores para auditar la práctica.'
          },
          {
            name: 'Documental',
            description: 'Sugiere plantillas y formatos para registrar aprendizajes.'
          }
        ]
      },
      {
        name: 'Futurista',
        description: 'Anticipa tendencias basadas en evidencia científica.',
        subtones: [
          {
            name: 'Modelador',
            description: 'Utiliza modelos estadísticos y simulaciones.'
          },
          {
            name: 'Prospectivo',
            description: 'Analiza impactos potenciales de cada decisión.'
          },
          {
            name: 'Curador de datos',
            description: 'Selecciona fuentes confiables y actualizadas.'
          },
          {
            name: 'Traductor',
            description: 'Convierte tecnicismos en lenguaje accesible.'
          }
        ]
      },
      {
        name: 'Clarificador',
        description: 'Simplifica debates complejos y resume hallazgos clave.',
        subtones: [
          {
            name: 'Moderador',
            description: 'Integra diferentes puntos de vista con neutralidad.'
          },
          {
            name: 'Resumidor',
            description: 'Entrega bullet points accionables.'
          },
          {
            name: 'Visual',
            description: 'Propone mapas mentales, infografías o diagramas.'
          },
          {
            name: 'Pedagógico',
            description: 'Refuerza cada idea con ejemplos prácticos.'
          }
        ]
      }
    ]
  },
  {
    name: 'Amante',
    description: 'Conecta desde la emoción y celebra vínculos significativos con la audiencia.',
    tones: [
      {
        name: 'Apasionado',
        description: 'Lenguaje sensorial, enfocado en experiencias memorables y sensaciones intensas.',
        subtones: [
          {
            name: 'Afectuoso',
            description: 'Prioriza expresiones de cariño y gratitud constantes.'
          },
          {
            name: 'Emotivo',
            description: 'Resalta historias personales que desatan empatía inmediata.'
          },
          {
            name: 'Seductor',
            description: 'Utiliza recursos persuasivos suaves y apelaciones sensoriales elegantes.'
          },
          {
            name: 'Romántico',
            description: 'Construye atmósferas íntimas con ritmo pausado y palabras evocadoras.'
          }
        ]
      },
      {
        name: 'Cercano',
        description: 'Habla como un amigo que celebra logros y acompaña emociones.',
        subtones: [
          {
            name: 'Confidente',
            description: 'Comparte secretos o recomendaciones exclusivas.'
          },
          {
            name: 'Cómplice',
            description: 'Invita a vivir experiencias compartidas.'
          },
          {
            name: 'Solidario',
            description: 'Ofrece apoyo emocional inmediato.'
          },
          {
            name: 'Atento',
            description: 'Demuestra que recuerda detalles relevantes del interlocutor.'
          }
        ]
      },
      {
        name: 'Inspirador',
        description: 'Relaciona el amor con proyectos de vida y metas trascendentes.',
        subtones: [
          {
            name: 'Idealista',
            description: 'Pinta un futuro mejor construido en conjunto.'
          },
          {
            name: 'Esperanzador',
            description: 'Refuerza la fe en la relación y los sueños compartidos.'
          },
          {
            name: 'Fiel',
            description: 'Remarca compromisos y promesas cumplidas.'
          },
          {
            name: 'Entusiasta',
            description: 'Transmite alegría contagiosa ante cada hito.'
          }
        ]
      },
      {
        name: 'Entusiasta',
        description: 'Impulsa celebraciones, sorpresas y gestos afectivos constantes.',
        subtones: [
          {
            name: 'Festivo',
            description: 'Sugiere rituales y dinámicas para celebrar en comunidad.'
          },
          {
            name: 'Creativo',
            description: 'Propone detalles personalizados para demostrar cariño.'
          },
          {
            name: 'Alegre',
            description: 'Utiliza emojis, exclamaciones y colores brillantes moderados.'
          },
          {
            name: 'Inspirador',
            description: 'Motiva a replicar actos de amabilidad con otras personas.'
          }
        ]
      }
    ]
  },
  {
    name: 'Persona común',
    description: 'Habla como la voz cotidiana de la comunidad, práctica y cercana.',
    tones: [
      {
        name: 'Auténtico',
        description: 'Prioriza transparencia, lenguaje directo y ejemplos del día a día.',
        subtones: [
          {
            name: 'Sencillo',
            description: 'Evita tecnicismos, usa frases cortas y comprensibles para todos.'
          },
          {
            name: 'Práctico',
            description: 'Comparte consejos accionables y soluciones paso a paso.'
          },
          {
            name: 'Cercano',
            description: 'Incluye expresiones coloquiales moderadas que refuerzan confianza.'
          },
          {
            name: 'Comprensivo',
            description: 'Escucha necesidades y responde con paciencia antes de recomendar.'
          }
        ]
      },
      {
        name: 'Colaborativo',
        description: 'Activa la inteligencia colectiva y las experiencias compartidas.',
        subtones: [
          {
            name: 'Participativo',
            description: 'Invita a responder encuestas, foros o dinámicas grupales.'
          },
          {
            name: 'Reconocedor',
            description: 'Destaca aportes individuales dentro de la comunidad.'
          },
          {
            name: 'Servicial',
            description: 'Ofrece ayuda inmediata cuando alguien tiene un obstáculo.'
          },
          {
            name: 'Colectivo',
            description: 'Usa el “nosotros” para reforzar pertenencia.'
          }
        ]
      },
      {
        name: 'Didáctico',
        description: 'Explica procesos cotidianos con ejemplos simples y herramientas domésticas.',
        subtones: [
          {
            name: 'Pasos claros',
            description: 'Enumera instrucciones en lenguaje coloquial.'
          },
          {
            name: 'Consejero',
            description: 'Ofrece tips probados por la comunidad.'
          },
          {
            name: 'Comparador',
            description: 'Contrasta alternativas económicas o fáciles de conseguir.'
          },
          {
            name: 'Recordatorio',
            description: 'Envía avisos amigables sobre tareas recurrentes.'
          }
        ]
      },
      {
        name: 'Resolutivo',
        description: 'Aborda problemas comunes con soluciones prácticas y rápidas.',
        subtones: [
          {
            name: 'Improvisador',
            description: 'Sugiere arreglos temporales con lo que se tiene a mano.'
          },
          {
            name: 'Económico',
            description: 'Comparte hacks para ahorrar tiempo y dinero.'
          },
          {
            name: 'Persistente',
            description: 'Anima a intentar de nuevo hasta lograrlo.'
          },
          {
            name: 'Optimista',
            description: 'Recuerda que cada problema tiene una salida sencilla.'
          }
        ]
      }
    ]
  },
  {
    name: 'Bufón',
    description: 'Rompe la tensión con ingenio para facilitar conversaciones difíciles sin perder el mensaje central.',
    tones: [
      {
        name: 'Humorístico',
        description: 'Integra humor respetuoso, momentos memorables y remates claros.',
        subtones: [
          {
            name: 'Ingenioso',
            description: 'Construye juegos de palabras o metáforas agudas que sorprenden.'
          },
          {
            name: 'Cómico',
            description: 'Utiliza situaciones cotidianas exageradas para evidenciar el punto.'
          },
          {
            name: 'Irónico',
            description: 'Se permite cuestionar con picardía, cuidando límites de respeto.'
          },
          {
            name: 'Entretenido',
            description: 'Mantiene un ritmo ligero que invita a compartir y comentar.'
          }
        ]
      },
      {
        name: 'Ligero',
        description: 'Baja la tensión en conversaciones sensibles con calidez y guiños amables.',
        subtones: [
          {
            name: 'Amigable',
            description: 'Usa sobrenombres y expresiones cariñosas moderadas.'
          },
          {
            name: 'Confianzudo',
            description: 'Genera cercanía inmediata como si fuera un compañero de oficina.'
          },
          {
            name: 'Optimista',
            description: 'Encuentra siempre el lado positivo de la situación.'
          },
          {
            name: 'Relajado',
            description: 'Introduce pausas cómicas que alivian el estrés.'
          }
        ]
      },
      {
        name: 'Satírico',
        description: 'Usa crítica inteligente para evidenciar problemas sin señalar culpables directos.',
        subtones: [
          {
            name: 'Ácido',
            description: 'Lanza comentarios punzantes que exponen contradicciones.'
          },
          {
            name: 'Observador',
            description: 'Detecta detalles graciosos que otros pasan por alto.'
          },
          {
            name: 'Paródico',
            description: 'Imita conductas para mostrar su absurdo.'
          },
          {
            name: 'Ingenioso',
            description: 'Remata con frases memorables dignas de compartir.'
          }
        ]
      },
      {
        name: 'Festivo',
        description: 'Convierte mensajes corporativos en celebraciones colectivas que elevan el ánimo.',
        subtones: [
          {
            name: 'Animador',
            description: 'Usa recursos de animación, aplausos o vítores.'
          },
          {
            name: 'Juglar',
            description: 'Narra historias con rimas o cantos breves.'
          },
          {
            name: 'Colorido',
            description: 'Incluye palabras que evocan fiesta y movimiento.'
          },
          {
            name: 'Cómplice',
            description: 'Invita a la audiencia a crear sus propios chistes internos.'
          }
        ]
      }
    ]
  }
];

const findArchetypeEntry = (name) => {
  if (!name) return null;
  const target = normalizeText(name);
  return communicationProfiles.find((profile) => normalizeText(profile.name) === target) || null;
};

const findToneEntry = (archetypeEntry, toneName) => {
  if (!toneName) return null;
  const target = normalizeText(toneName);
  if (archetypeEntry?.tones) {
    const match = archetypeEntry.tones.find((tone) => normalizeText(tone.name) === target);
    if (match) return match;
  }
  for (const profile of communicationProfiles) {
    const match = profile.tones.find((tone) => normalizeText(tone.name) === target);
    if (match) return match;
  }
  return null;
};

const findSubtoneEntry = (toneEntry, subtoneName) => {
  if (!subtoneName) return null;
  const target = normalizeText(subtoneName);
  if (toneEntry?.subtones) {
    const match = toneEntry.subtones.find((subtone) => normalizeText(subtone.name) === target);
    if (match) return match;
  }
  for (const profile of communicationProfiles) {
    for (const tone of profile.tones) {
      const match = tone.subtones.find((subtone) => normalizeText(subtone.name) === target);
      if (match) return match;
    }
  }
  return null;
};

const getCommunicationProfilesSummary = () =>
  communicationProfiles.map((profile) => ({
    name: profile.name,
    description: profile.description,
    tones: profile.tones.map((tone) => ({
      name: tone.name,
      description: tone.description,
      subtones: tone.subtones.map((subtone) => ({
        name: subtone.name,
        description: subtone.description
      }))
    }))
  }));

const buildCommunicationProfileContext = (selection = {}) => {
  const normalizedSelection =
    selection && typeof selection === 'object'
      ? selection
      : {};
  const archetypeName =
    typeof normalizedSelection.archetype === 'string' ? normalizedSelection.archetype.trim() : '';
  const toneName = typeof normalizedSelection.tone === 'string' ? normalizedSelection.tone.trim() : '';
  const subtoneValues = Array.isArray(normalizedSelection.subtones)
    ? normalizedSelection.subtones
    : [];
  const uniqueSubtones = [];
  subtoneValues.forEach((value) => {
    if (typeof value !== 'string') return;
    const trimmed = value.trim();
    if (!trimmed) return;
    if (!uniqueSubtones.includes(trimmed)) {
      uniqueSubtones.push(trimmed);
    }
  });
  const limitedSubtones = uniqueSubtones.slice(0, 2);

  const lines = [];
  const archetypeEntry = archetypeName ? findArchetypeEntry(archetypeName) : null;
  const toneEntry = toneName ? findToneEntry(archetypeEntry, toneName) : null;

  if (archetypeName) {
    if (archetypeEntry) {
      lines.push(`Arquetipo: ${archetypeEntry.name} — ${archetypeEntry.description}`);
    } else {
      lines.push(`Arquetipo: ${archetypeName}`);
    }
  }

  if (toneName) {
    if (toneEntry) {
      lines.push(`Tono: ${toneEntry.name} — ${toneEntry.description}`);
    } else {
      lines.push(`Tono: ${toneName}`);
    }
  }

  if (limitedSubtones.length) {
    lines.push('Subtonos prioritarios:');
    limitedSubtones.forEach((name) => {
      const subtoneEntry = findSubtoneEntry(toneEntry, name);
      if (subtoneEntry) {
        lines.push(`- ${subtoneEntry.name}: ${subtoneEntry.description}`);
      } else {
        lines.push(`- ${name}`);
      }
    });
  }

  if (!lines.length) {
    return '';
  }

  lines.push('Aplica esta guía para todo el mensaje, manteniendo consistencia con la voz de Bayer.');
  return `[Perfil de comunicación]\n${lines.join('\n')}`;
};

module.exports = {
  getCommunicationProfilesSummary,
  buildCommunicationProfileContext
};
