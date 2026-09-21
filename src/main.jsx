import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap-icons/font/bootstrap-icons.css'
import './index.css'
import 'bootstrap/dist/js/bootstrap.bundle.min.js'
import Layout from './components/Layout.jsx'
import RequireAuth from './components/RequireAuth.jsx'
import Home from './pages/Home.jsx'
import CompraRapida from './pages/CompraRapida.jsx'
import Licitacion from './pages/Licitacion.jsx'
import Login from './pages/Login.jsx'
import MiEmpresa from './pages/MiEmpresa.jsx'
import Administracion from './pages/Administracion.jsx'
import EmpresaDetalle from './pages/EmpresaDetalle.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<RequireAuth />}>
          <Route element={<Layout />}>
            <Route path="/" element={<Home />} />
            <Route path="/compra-agil" element={<CompraRapida />} />
            <Route path="/licitacion" element={<Licitacion />} />
            <Route path="/mi-empresa" element={<MiEmpresa />} />
            <Route path="/administracion" element={<Administracion />} />
            <Route path="/administracion/empresas/:id" element={<EmpresaDetalle />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
