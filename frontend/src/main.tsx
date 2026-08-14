import React from "react"
import ReactDOM from "react-dom/client"
import { CssBaseline } from "@mui/material"
import { ThemeProvider } from "@mui/material/styles"
import App from "./App"
import web3Theme from "./theme"
import { ToastContainer } from "react-toastify"
import "react-toastify/dist/ReactToastify.css"
import { setupSfx } from "./utils/sfx"
import ErrorBoundary from "./components/ErrorBoundary"
import { initTelemetry } from "./utils/telemetry"

setupSfx()
initTelemetry()

const root = ReactDOM.createRoot(document.getElementById("root") as HTMLElement)
root.render(
  <ThemeProvider theme={web3Theme}>
    <ToastContainer
      position="top-right"
      autoClose={5000} // auto close after 5 seconds
      hideProgressBar={false}
      newestOnTop={false}
      closeOnClick
      rtl={false} // set to true if you're using a right-to-left language
      pauseOnFocusLoss
      draggable
      pauseOnHover
      theme="dark"
      toastClassName="peerpay-toast"
      progressClassName="peerpay-toast-progress"
    />
    <CssBaseline />
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </ThemeProvider>
)
