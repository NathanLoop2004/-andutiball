-- El tercer momento: cuando SE ACABA EL TIEMPO. Reemplaza al "Time is Up!" de HaxBall.
--
-- Es distinto de la victoria: el partido puede terminar porque alguien llegó al límite de
-- goles (ahí va el cartel de victoria) o porque se acabó el reloj (ahí va este).
-- La tabla ya existe y ya tiene la columna `momento`: solo se siembra el de fábrica.

INSERT INTO "carteles_momento"
  ("clave", "momento", "nombre", "descripcion", "plantilla", "colores", "color", "estilo", "puesto")
VALUES (
  'se-acabo',
  'tiempo',
  'Se acabó el tiempo',
  'El de siempre: avisa que terminó por reloj y cómo quedó',
  '⏱️ ¡SE ACABÓ EL TIEMPO! {rojo} {golesRojo} 🆚 {golesAzul} {azul}',
  ARRAY[]::TEXT[],
  'FFD700',
  'bold',
  true
);
