# Keyster - Setup Instructions

## 📦 Instalación de Nuevas Dependencias

Para instalar las nuevas dependencias de testing:

```bash
npm install --save-dev vitest@^2.1.8 @vitest/ui@^2.1.8 jsdom@^25.0.1
```

O simplemente ejecuta:

```bash
npm install
```

## 🧪 Ejecutar Tests

```bash
# Ejecutar todos los tests
npm test

# Ejecutar tests con UI interactiva
npm run test:ui

# Generar reporte de cobertura
npm run test:coverage
```

## 🚀 Desarrollo

```bash
# Iniciar servidor de desarrollo
npm run dev

# Build para producción
npm run build

# Preview del build
npm run preview
```

## 📁 Estructura de Nuevos Archivos

```
src/
├── lib/
│   ├── config.ts                    # ✨ Configuración centralizada
│   ├── hooks/
│   │   ├── useDebounce.ts          # ✨ Hook de debounce
│   │   └── useCopyToClipboard.ts   # ✨ Hook para copiar
│   ├── scanners/
│   │   ├── types.ts                 # ✨ Tipos compartidos
│   │   ├── validation.ts            # ✨ Validación de keys
│   │   ├── github.ts                # ✨ Scanner de GitHub
│   │   └── providerPatterns.ts      # ✨ Patrones de providers
│   └── utils/
│       ├── logger.ts                # ✨ Sistema de logging
│       ├── errorHandlers.ts         # ✨ Manejo de errores
│       ├── errorHandlers.test.ts    # ✨ Tests
│       ├── keyExtraction.ts         # ✨ Extracción de keys
│       ├── keyExtraction.test.ts    # ✨ Tests
│       ├── async.ts                 # ✨ Utilidades async
│       └── async.test.ts            # ✨ Tests
├── test/
│   └── setup.ts                     # ✨ Configuración de tests
└── components/
    └── ErrorBoundary.css            # ✨ Estilos del ErrorBoundary

vitest.config.ts                     # ✨ Configuración de Vitest
IMPROVEMENTS.md                      # ✨ Documentación de mejoras
SETUP.md                             # ✨ Este archivo
```

## ✅ Verificar Instalación

Después de instalar, verifica que todo funcione:

```bash
# 1. Verificar que el proyecto compila
npm run build

# 2. Verificar que los tests pasan
npm test

# 3. Verificar que el dev server funciona
npm run dev
```

## 🔧 Solución de Problemas

### Error: "Cannot find module 'vitest'"
```bash
npm install
```

### Error: TypeScript no encuentra los tipos
```bash
npm install --save-dev @types/node
```

### Tests no se ejecutan
Asegúrate de que `vitest.config.ts` esté en la raíz del proyecto.

## 📚 Recursos

- [Vitest Documentation](https://vitest.dev/)
- [React Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)

## 🎯 Próximos Pasos

1. Revisa `IMPROVEMENTS.md` para ver todas las mejoras
2. Ejecuta los tests para familiarizarte con ellos
3. Explora los nuevos módulos en `src/lib/`
4. Prueba el sistema de logging en desarrollo

---

¿Necesitas ayuda? Revisa la documentación completa en `IMPROVEMENTS.md`
