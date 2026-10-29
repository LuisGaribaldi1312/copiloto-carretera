# Copiloto Inteligente y de Seguridad para Carretera 🚗💨

Plataforma unificada Web (PWA instalable) y Móvil (Android/iOS vía Capacitor) diseñada específicamente para la navegación segura en autopistas y carreteras desoladas.

---

## 🌟 Características Principales

1. **Modo Dual de Vehículo**:
   - **Escáner OBD-II Bluetooth (BLE)**: Compatible con adaptadores estándar ELM327 (v1.5 / v2.1 / V-Gate / iCar). Lee RPM, velocidad de computadora, nivel de combustible y códigos de falla del motor (DTC / Check Engine).
   - **Perfil Manual con Odometría Matemática**: Si no tienes escáner, ingresa marca, modelo, año, capacidad del tanque (L) y rendimiento en carretera (km/L). El sistema calcula dinámicamente el combustible restante compensando el arrastre aerodinámico por velocidad.
2. **Alertas Inteligentes de Llantas y Seguridad**:
   - Algoritmo térmico: Estima la temperatura superficial del asfalto (+18°C sobre la temperatura ambiente) y alerta sobre la sobreexpansión de presión en neumáticos en recorridos prolongados (>60-90 min).
   - Alerta preventiva de fatiga: Notificación para paradas seguras y revisión de niveles tras 2 horas continuas al volante.
3. **Bóveda de Emergencia SOS (Offline)**:
   - Almacenamiento local de número de póliza, cabina directa de aseguradora y contactos de emergencia.
   - Envío de SOS con coordenadas satelitales GPS exactas mediante enlace SMS directo (opera a nivel red celular 2G/voz, sin requerir paquete de datos de internet).
4. **Simulador Integrado**:
   - Puedes probar toda la telemetría, velocímetro, tacómetro y medidores en vivo desde tu navegador con el simulador virtual ELM327 incorporado.

---

## 🚀 Inicio Rápido

### Requisitos
- Node.js v18+ instalado.

### Comandos
```bash
# Iniciar servidor de desarrollo en http://localhost:3000
npm run dev

# Compilar para producción (Web PWA / Capacitor)
npm run build

# Previsualizar el build de producción localmente
npm run preview
```

---

## 📁 Estructura del Proyecto

```
PROYECTO GPS COMPLETO/
├── index.html                     # Entrada HTML con soporte PWA y Tailwind
├── package.json                   # Dependencias y scripts
├── tsconfig.json                  # Configuración TypeScript estricta
├── vite.config.ts                 # Configuración de compilación Vite
├── src/
│   ├── types/
│   │   └── vehicle.ts             # Interfaces de Perfil, Telemetría OBD, Alertas y Viaje
│   ├── services/
│   │   ├── obd/
│   │   │   ├── elm327Parser.ts    # Parser SAE J1979 (PIDs 010C, 010D, 012F, 0105 y DTCs)
│   │   │   └── obdBluetoothService.ts # Servicio Web Bluetooth API + Simulador virtual
│   │   ├── telemetry/
│   │   │   └── vehicleEstimator.ts    # Motor matemático de combustible, arrastre y llantas
│   │   └── storage/
│   │       └── vehicleStorage.ts      # Persistencia local del perfil y configuración
│   ├── components/
│   │   ├── common/
│   │   │   └── Icons.tsx          # Iconos SVG nativos ultraligeros
│   │   ├── layout/
│   │   │   └── Navbar.tsx         # Barra superior con estado y acceso SOS
│   │   ├── vehicle/
│   │   │   └── VehicleProfileForm.tsx # Formulario interactivo del perfil del auto
│   │   ├── obd/
│   │   │   └── ObdLiveMonitor.tsx     # Cuadro de mandos con telemetría en vivo y alertas
│   │   ├── emergency/
│   │   │   └── EmergencyModal.tsx     # Bóveda de emergencia y envío de SMS con GPS
│   │   └── roadmap/
│   │       └── ArchitectureRoadmap.tsx# Vista del plan de los siguientes módulos
│   ├── App.tsx                    # Componente raíz
│   ├── main.tsx                   # Punto de entrada React
│   └── index.css                  # Estilos base y animaciones
```
