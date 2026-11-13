# Evaluador semántico de lógica de predicados

Proyecto de MM3032 Lógica Matemática, Universidad del Valle de Guatemala.

Autores: Paula Daniela De León Godoy y Luis Pedro Barillas Barrientos.

Aplicación publicada: https://parcial3logicamate.netlify.app/

Aplicación gráfica que determina si una fórmula de primer orden es verdadera o falsa en una interpretación finita ingresada por el usuario. Muestra además las razones decisivas del resultado: un testigo para un existencial verdadero, un contraejemplo para un universal falso y la comprobación completa para un universal verdadero o un existencial falso.

Es una aplicación web estática, escrita en HTML, CSS y JavaScript sin dependencias ni paso de compilación. El punto de entrada es `index.html`.

## Requerimientos del proyecto

| Requerimiento | Implementación |
|---|---|
| 1. Lenguaje configurable | Sección 1 de la interfaz. Predicados, funciones y constantes con nombre y aridad. Validación en `js/interp.js` |
| 2. Interpretación | Sección 2. Dominio finito no vacío, función total para cada símbolo funcional y relación no vacía para cada predicado. `js/interp.js` |
| 3. Sintaxis | Conectivos `¬ ∧ ∨ →` e igualdad `=`. Se admiten además `↔` y `≠`. `js/syntax.js` |
| 4. Variables y cuantificadores | Fórmulas abiertas y cerradas, variables libres y ligadas, y entorno solicitado para las variables libres. `js/syntax.js` y sección 4 |
| 5. Interfaz | Ingreso gráfico del lenguaje, la interpretación, la fórmula y el entorno. Botones para `¬ ∧ ∨ → ∀ ∃ ( )` y edición con teclado. `index.html` y `js/app.js` |
| 6. Resultado | Verdadero o Falso con testigo, contraejemplo o comprobación completa según el caso. `js/evaluator.js` |
| 7. Validación | Errores de sintaxis con posición, símbolos, aridades, dominio, tuplas y asignaciones faltantes o inválidas. Una entrada incorrecta no recibe valor de verdad. `js/analyze.js` |

## Lenguaje y sintaxis

- Variables: `u v w x y z` con subíndice opcional (`x1`, `x_2`). Estos nombres están reservados.
- Constantes: símbolos funcionales de aridad 0.
- Precedencia de mayor a menor: `¬` y cuantificadores, `∧`, `∨`, `→` (asocia a la derecha), `↔`.
- Un cuantificador alcanza únicamente a la fórmula inmediata que le sigue, igual que la negación. Así, `∀x P(x) → Q(x)` equivale a `(∀x P(x)) → Q(x)`. La lectura con paréntesis completos se muestra bajo el campo de la fórmula.
- Alternativas de teclado: `~` o `!` para ¬, `&` o `^` o `/\` para ∧, `|` o `\/` para ∨, `->` o `=>` para →, `<->` para ↔, `forall` y `exists` para los cuantificadores, `!=` para ≠.
- Límites: dominio de hasta 30 elementos y aridad máxima 5.

## Formato de la interpretación

- Predicado unario: `1, 2`. Predicado de aridad 2 o más: `(1, 2), (2, 3)`.
- Función de aridad n: una línea por tupla, por ejemplo `1, 2 -> 3`. Debe estar definida en todo `D^n`.
- Constante: el elemento del dominio, por ejemplo `a`.
- Cada símbolo puede editarse también como tabla gráfica, sincronizada con el texto.

## Aportes creativos

- Buscador de modelos y contramodelos sobre dominios pequeños.
- Árbol sintáctico en SVG con variables libres y ligadas diferenciadas.
- Evaluación completa que lista todos los testigos y contraejemplos.
- Ejemplos del curso, y exportación e importación del estado en JSON.

La justificación de cada uno está en [`docs/aportes-creativos.md`](docs/aportes-creativos.md).

## Fundamentos

La definición de verdad implementada, las razones decisivas y las decisiones de diseño están en [`docs/fundamentos.md`](docs/fundamentos.md).

## Pruebas

Las pruebas automáticas están en `tests/` y usan `node:test` (`npm test`, Node 18 o superior). Comprenden pruebas unitarias de sintaxis, interpretación, evaluación y razones decisivas, y una prueba diferencial que compara el evaluador con una implementación independiente de la definición sobre 1500 casos aleatorios. Un workflow de GitHub Actions (`.github/workflows/tests.yml`) las ejecuta en cada push.

## Estructura

```
index.html          Interfaz
css/style.css       Estilos
js/syntax.js        Análisis léxico y sintáctico, variables libres y ligadas
js/interp.js        Lenguaje, dominio, interpretación y entorno
js/evaluator.js     Semántica de Tarski, trazas y razones decisivas
js/analyze.js       Validación de todas las entradas y evaluación
js/finder.js        Buscador de modelos y contramodelos
js/tree.js          Árbol sintáctico en SVG
js/examples.js      Ejemplos del curso
js/app.js           Controlador de la interfaz
tests/              Pruebas automáticas
docs/               Fundamentos y aportes creativos
```