export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-vetify-crema px-6 text-center">
      <h1 className="font-serif text-4xl font-semibold text-vetify-verde-oscuro">
        Vetify
      </h1>
      <p className="max-w-md text-vetify-verde">
        Proyecto inicializado. Faltan la autenticación, el expediente y las
        pantallas reales — ver <code>docs/PLAN_DESARROLLO.md</code>.
      </p>
    </div>
  );
}
