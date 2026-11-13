# Aportes creativos

Proyecto de MM3032 Lógica Matemática, UVG. Autores: Paula Daniela de León y Luis Pedro Barillas Barrientos.

## 1. Buscador de modelos y contramodelos (`js/finder.js`)

Explora todas las interpretaciones del lenguaje declarado sobre dominios `{1, ..., k}` con k hasta 4 y carga la primera que encuentre. Respeta las reglas del proyecto: funciones totales y relaciones no vacías.

Valor: responde en la práctica a las preguntas de las presentaciones sobre satisfacibilidad y validez, por ejemplo "encontrar una interpretación en la que la fórmula sea falsa o demostrar que es válida". Un contramodelo prueba que una fórmula no es válida. No hallarlo en dominios pequeños no prueba su validez, y la aplicación lo advierte.

Pruebas: `tests/extras.test.js`. La interpretación hallada se reproduce con el evaluador normal, y se verifica el presupuesto de búsqueda.

## 2. Árbol sintáctico con variables libres y ligadas (`js/tree.js`)

Dibuja en SVG el árbol de la fórmula e identifica con colores las variables libres y las ligadas. Es la herramienta que el curso usa para definir alcance de cuantificadores. Ayuda a detectar por qué una variable queda libre.

Pruebas: `tests/extras.test.js`.

## 3. Evaluación completa

Casilla que lista todos los testigos y contraejemplos en lugar de detenerse en el primero. Útil para entender un cuantificador.

## 4. Ejemplos del curso, exportar e importar JSON

Cargan con un clic los ejemplos de las presentaciones de Interpretaciones y Entornos, más casos sobre alcance de cuantificadores y una fórmula no válida. El estado completo se puede exportar e importar como JSON para compartir casos.

## 5. Lectura con paréntesis y edición por tabla

Cada fórmula se muestra con paréntesis completos para eliminar ambigüedad de precedencia. La interpretación puede editarse como texto o como tabla gráfica sincronizada.
