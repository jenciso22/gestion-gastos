export type Profile = {
  id: string
  name: string
  email: string
  created_at: string
}

export type Couple = {
  id: string
  user_a: string
  user_b: string | null
  invite_code: string
  created_at: string
}

export type Expense = {
  id: string
  user_id: string
  couple_id: string | null
  description: string
  amount: number
  category: string
  emoji: string
  merchant: string
  paid_by: string
  expense_date: string
  created_at: string
}

export const CATEGORIES = [
  { name: 'Supermercado', emoji: '🛒', keys: ['mercado','supermercado','walmart','chedraui','soriana','costco','bodega','aurrera','city market','carulla','exito','d1','jumbo'] },
  { name: 'Comida fuera', emoji: '🍽️', keys: ['restaurante','almuerzo','cena','desayuno','comida','pizza','hamburguesa','sushi','tacos','crepes','cafe','panaderia','beer','cerveza','bar','taqueria','mariscos'] },
  { name: 'Delivery', emoji: '🛵', keys: ['rappi','domicilio','delivery','ifood','uber eats','didi food','pedido'] },
  { name: 'Transporte', emoji: '🚗', keys: ['gasolina','uber','taxi','didi','pemex','bp','shell','bus','metro','metrobus','cabify','autopista','peaje','caseta','estacionamiento'] },
  { name: 'Servicios', emoji: '💡', keys: ['luz','agua','gas','cfe','telmex','telcel','att','movistar','izzi','totalplay','internet','telefono','factura','electricidad','enel','claro'] },
  { name: 'Hogar', emoji: '🏠', keys: ['hogar','limpieza','aseo','detergente','home depot','liverpool','coppel','ferreteria','reparacion','homecenter','sodimac'] },
  { name: 'Salud', emoji: '💊', keys: ['farmacia','medico','clinica','hospital','medicina','pastillas','vitaminas','dentista','doctor','consultorio'] },
  { name: 'Entretenimiento', emoji: '🎬', keys: ['cine','teatro','concierto','evento','parque','cinemex','cinepolis'] },
  { name: 'Suscripciones', emoji: '📱', keys: ['netflix','spotify','disney','amazon','youtube','apple','hbo','max','paramount','suscripcion','membresia'] },
  { name: 'Renta', emoji: '🏢', keys: ['renta','arriendo','administracion','propietario','apartamento','depa','arrendamiento'] },
  { name: 'Ropa', emoji: '👕', keys: ['ropa','zapatos','zara','shein','nike','adidas','camiseta','pantalon'] },
  { name: 'Educación', emoji: '📚', keys: ['colegio','universidad','curso','libro','matricula','educacion','clase','taller'] },
]

export function classifyExpense(text: string): { name: string; emoji: string } {
  const t = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  for (const cat of CATEGORIES) {
    if ((cat.keys as readonly string[]).some(k => t.includes(k))) return { name: cat.name, emoji: cat.emoji }
  }
  return { name: 'Otros', emoji: '💰' }
}

export function parseAmount(raw: string): { amount: number; desc: string } | null {
  const match = raw.match(/(\d+)/)
  if (!match) return null
  const amount = parseInt(match[1])
  if (!amount) return null
  return { amount, desc: raw.replace(match[1], '').trim() }
}

export function generateInviteCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

export function fmtMXN(n: number): string {
  return '$' + Math.round(n).toLocaleString('es-MX')
}
