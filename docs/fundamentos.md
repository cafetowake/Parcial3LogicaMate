# Fundamentos lógicos y decisiones de diseño

Proyecto de MM3032 Lógica Matemática, UVG. Autores: Paula Daniela de León y Luis Pedro Barillas Barrientos.

## Definición de verdad (Tarski)

`js/evaluator.js` implementa la definición de la presentación Entornos. Un entorno `l` asigna un elemento de `D` a cada variable. Casos:

- `P(t1, ..., tn)` es verdadera si y solo si `(a1, ..., an)` pertenece a `P^I`, donde cada `ai` es el valor de `ti` bajo `l`.
- `t1 = t2` es verdadera si y solo si ambos términos valen lo mismo.
- `¬φ`, `∧`, `∨`, `→` siguen las tablas de verdad habituales. La implicación es falsa solo con antecedente verdadero y consecuente falso.
- `∀x φ` es verdadera si y solo si `φ` es verdadera bajo `l[x ↦ a]` para todo `a` en `D`.
- `∃x φ` es verdadera si y solo si lo es para algún `a`.

## Razones decisivas

- Existencial verdadero: se muestra un testigo.
- Universal falso: se muestra un contraejemplo.
- Universal verdadero o existencial falso: comprobación completa de todos los elementos.
- Conectivos: se señala qué operando decide el valor.

## Variables libres y entorno

Solo las variables libres necesitan valor en el entorno. En un enunciado la elección del entorno es irrelevante. Una variable libre sin valor, o con un valor fuera de `D`, es un error y no hay veredicto.

## Validación

Se acumulan los errores de lenguaje, dominio, interpretación, fórmula y entorno por sección. Si hay alguno no se asigna valor de verdad (`js/analyze.js`).

## Decisiones de diseño

- Los cuantificadores ligan como la negación para evitar ambigüedad y se muestra siempre la lectura con paréntesis.
- Las variables son `u v w x y z` con subíndice, de modo que se distinguen de las constantes sin necesidad de declararlas.
- Las funciones deben ser totales y las relaciones no vacías, como exige el enunciado.
- El evaluador corta en el primer testigo o contraejemplo para ser eficiente, y la evaluación completa lo desactiva.
- Hay un límite de pasos y de nodos de traza para que dominios grandes no congelen el navegador. Al superarse el límite de pasos se informa y no se da valor.

## Pruebas

La prueba diferencial contrasta el evaluador con una implementación independiente de la definición (`tests/oracle.test.js`).
