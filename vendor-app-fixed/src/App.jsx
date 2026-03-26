import AppRoutes from "./routes/AppRoutes"

function App() {
  return (
    <div className="bg-black min-h-screen flex justify-center">
      <div className="w-full max-w-[420px] bg-bg text-white min-h-screen relative overflow-hidden">
        <AppRoutes />
      </div>
    </div>
  )
}

export default App