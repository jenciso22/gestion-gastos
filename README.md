# 💑 Gestion De Gastos

Tracker de gastos compartidos para parejas. Clasifica gastos automáticamente por categoría y los guarda en Google Sheets en tiempo real.

## ¿Cómo funciona?

1. Escribes el gasto en lenguaje natural: `800 mercado walmart`
2. La app lo clasifica automáticamente (Supermercado, Transporte, etc.)
3. Con un toque se guarda en Google Sheets compartido

## Stack

- HTML + CSS + JS puro (sin frameworks)
- Google Apps Script como backend gratuito
- Google Sheets como base de datos
- Vercel para hosting gratuito

## Setup

### 1. Google Sheets

Crea una hoja con estos encabezados en la fila 1:

| Fecha | Descripción | Categoría | Gasto (MXN) | Comercio | Pagado por | Mes | Año | Notas |

### 2. Google Apps Script

En tu Google Sheet ve a **Extensiones → Apps Script**, pega este código y despliega como Web App (acceso: cualquier persona):

```javascript
function doGet(e) {
  try {
    const sheet = SpreadsheetApp
      .getActiveSpreadsheet()
      .getSheetByName("Hoja 1");

    const d = new Date();
    const mes = d.toLocaleString("es-MX", { month: "long" });
    const anio = d.getFullYear();

    sheet.appendRow([
      e.parameter.fecha,
      e.parameter.desc,
      e.parameter.cat,
      Number(e.parameter.monto),
      e.parameter.comercio || "",
      e.parameter.persona,
      mes,
      anio,
      e.parameter.emoji + " " + e.parameter.cat
    ]);

    return ContentService
      .createTextOutput("OK")
      .setMimeType(ContentService.MimeType.TEXT);
  } catch(err) {
    return ContentService
      .createTextOutput("ERROR: " + err.message)
      .setMimeType(ContentService.MimeType.TEXT);
  }
}
```

### 3. Conectar al tracker

En `index.html`, reemplaza la URL en esta línea con la URL de tu Web App:

```js
const SHEET_URL = 'https://script.google.com/macros/s/TU_URL_AQUI/exec';
```

### 4. Deploy en Vercel

1. Sube este repo a GitHub
2. Ve a [vercel.com](https://vercel.com) → New Project → selecciona el repo → Deploy
3. Comparte la URL con tu pareja

## Instalar como app en el celular

- **iPhone:** Safari → Compartir → Agregar a pantalla de inicio
- **Android:** Chrome → Menú → Agregar a pantalla de inicio

## Categorías reconocidas

🛒 Supermercado · 🍽️ Comida fuera · 🛵 Delivery · 🚗 Transporte · 💡 Servicios · 🏠 Hogar · 💊 Salud · 🎬 Entretenimiento · 📱 Suscripciones · 🏢 Renta · 👕 Ropa · 📚 Educación · 💰 Otros
