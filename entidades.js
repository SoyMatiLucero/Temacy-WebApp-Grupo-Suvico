/*
 * Las entidades del grupo y el nombre de la app. Es el único lugar donde se tocan.
 *
 * `clave` es la clave pública del chat web de cada entidad (la misma que ya figura en su página).
 * El nombre del bot, el color y el logo NO van acá: los trae la configuración del chat de cada
 * entidad, así lo que la entidad cambia en la plataforma se ve acá sin tocar este archivo.
 * `color` es sólo el de reserva, para cuando esa configuración todavía no llegó.
 */
window.GRUPO = {
  // Provisorio: falta definir la marca del grupo (docs/plan_webapp.md, sección 8).
  nombre: 'Atención al afiliado',
  entidades: [
    {
      slug: 'suvico',
      nombre: 'SUVICO',
      que: 'El sindicato',
      temas: 'Sueldo, derechos y beneficios del sindicato.',
      clave: 'wk_suvico_7b3e2a9c14',
      color: '#DF040B'
    },
    {
      slug: 'mavic',
      nombre: 'Mavic',
      que: 'La mutual',
      temas: 'Cuota, sepelio, subsidios, capacitación y beneficios.',
      clave: 'wk_af3f6d9ebe7f380d36519ded',
      color: '#30C0D8'
    },
    {
      slug: 'ospevic',
      nombre: 'OSPEVIC',
      que: 'La obra social',
      temas: 'Órdenes, farmacia, urgencias, centro médico y afiliación.',
      clave: 'wk_ospevic_7e08f0c3382f2f',
      color: '#10C0D0'
    }
  ]
};
