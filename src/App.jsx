import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

export default function App() {
  const [vista, setVista] = useState('maestro'); // 'maestro' o 'alumno'
  const [usuarios, setUsuarios] = useState([]);
  const [asistencias, setAsistencias] = useState([]);
  const [pagos, setPagos] = useState([]);

  // Formulario de usuario (Creación y Edición)
  const [rut, setRut] = useState('');
  const [nombre, setNombre] = useState('');
  const [fechaNac, setFechaNac] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [correo, setCorreo] = useState('');
  const [grado, setGrado] = useState('Blanca');
  const [tipoUsuario, setTipoUsuario] = useState('alumno');
  
  // Estado para saber si estamos editando un usuario existente
  const [editandoRut, setEditandoRut] = useState(null);

  // Formulario de nuevo pago
  const [pagoRut, setPagoRut] = useState('');
  const [mesCuota, setMesCuota] = useState('Septiembre 2026');
  const [fechaVencimiento, setFechaVencimiento] = useState('');

  // Filtro de alumno para la vista de estudiante
  const [rutAlumnoActual, setRutAlumnoActual] = useState('');

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    const { data: uData } = await supabase.from('usuarios').select('*');
    if (uData) setUsuarios(uData);

    const { data: aData } = await supabase.from('asistencia').select('*');
    if (aData) setAsistencias(aData);

    const { data: pData } = await supabase.from('pagos').select('*');
    if (pData) setPagos(pData);
  };

  const limpiarFormulario = () => {
    setRut(''); setNombre(''); setFechaNac(''); setWhatsapp(''); setCorreo(''); setGrado('Blanca'); setTipoUsuario('alumno');
    setEditandoRut(null);
  };

  const guardarUsuario = async (e) => {
    e.preventDefault();

    if (editandoRut) {
      // Modo Actualización
      const { error } = await supabase
        .from('usuarios')
        .update({
          nombre_completo: nombre,
          fecha_nacimiento: fechaNac || null,
          telefono_whatsapp: whatsapp,
          correo_electronico: correo,
          grado,
          tipo_usuario: tipoUsuario
        })
        .eq('rut', editandoRut);

      if (error) {
        alert('Error al actualizar: ' + error.message);
      } else {
        alert('¡Datos del usuario actualizados con éxito!');
        limpiarFormulario();
        cargarDatos();
      }
    } else {
      // Modo Creación Nuevo
      const { error } = await supabase.from('usuarios').insert([
        {
          rut,
          nombre_completo: nombre,
          fecha_nacimiento: fechaNac || null,
          telefono_whatsapp: whatsapp,
          correo_electronico: correo,
          grado,
          tipo_usuario: tipoUsuario
        }
      ]);

      if (error) {
        alert('Error al registrar: ' + error.message);
      } else {
        alert('¡Usuario registrado con éxito!');
        limpiarFormulario();
        cargarDatos();
      }
    }
  };

  const iniciarEdicion = (u) => {
    setEditandoRut(u.rut);
    setRut(u.rut);
    // Limpiamos la etiqueta [INACTIVO] temporalmente para que el Maestro la edite cómodo si quiere
    setNombre(u.nombre_completo.replace('[INACTIVO] ', ''));
    setFechaNac(u.fecha_nacimiento || '');
    setWhatsapp(u.telefono_whatsapp);
    setCorreo(u.correo_electronico || '');
    setGrado(u.grado);
    setTipoUsuario(u.tipo_usuario);
    window.scrollTo({ top: 0, behavior: 'smooth' }); // Sube la pantalla al formulario
  };

  const toggleEstadoUsuario = async (u) => {
    const estaInactivo = u.nombre_completo.includes('[INACTIVO]');
    let nuevoNombre = estaInactivo ? u.nombre_completo.replace('[INACTIVO] ', '') : `[INACTIVO] ${u.nombre_completo}`;

    const { error } = await supabase
      .from('usuarios')
      .update({ nombre_completo: nuevoNombre })
      .eq('rut', u.rut);

    if (error) {
      alert('Error al actualizar estado: ' + error.message);
    } else {
      cargarDatos();
    }
  };

  const crearClaseAsistencia = async () => {
    const fechaHoy = new Date().toISOString().split('T')[0];
    const yaExisteHoy = asistencias.some(a => a.fecha_clase === fechaHoy);
    
    if (yaExisteHoy) {
      alert('⚠️ Ya existe un registro de asistencia creado para el día de hoy.');
      return;
    }

    const usuariosActivos = usuarios.filter(u => !u.nombre_completo.includes('[INACTIVO]'));
    if (usuariosActivos.length === 0) {
      alert('No hay usuarios activos para crear asistencia.');
      return;
    }

    const nuevasAsistencias = usuariosActivos.map(alerta => ({
      rut_estudiante: alerta.rut,
      fecha_clase: fechaHoy,
      estado: 'pendiente',
      notificado: false
    }));

    const { error } = await supabase.from('asistencia').insert(nuevasAsistencias);
    if (error) {
      alert('Error al crear asistencia: ' + error.message);
    } else {
      alert('¡Asistencias de la clase de hoy creadas con éxito!');
      cargarDatos();
    }
  };

  const notificarTodosHoy = async () => {
    const fechaHoy = new Date().toISOString().split('T')[0];
    const pendientesHoy = asistencias.filter(a => a.fecha_clase === fechaHoy && !a.notificado);

    if (pendientesHoy.length === 0) {
      alert('No hay notificaciones pendientes para hoy o ya fueron enviadas.');
      return;
    }

    const idsPendientes = pendientesHoy.map(p => p.id);
    await supabase.from('asistencia').update({ notificado: true }).in('id', idsPendientes);

    let primerEnviado = false;
    pendientesHoy.forEach(p => {
      const u = usuarios.find(us => us.rut === p.rut_estudiante);
      if (u && !primerEnviado) {
        const url = `https://wa.me/${u.telefono_whatsapp}?text=${encodeURIComponent(`Hola ${u.nombre_completo}, te notificamos la clase de Jiu-Jitsu de hoy (${p.fecha_clase}). Por favor confirma tu asistencia en la plataforma.`)}`;
        window.open(url, '_blank');
        primerEnviado = true;
      }
    });

    alert(`¡Se marcaron ${pendientesHoy.length} notificaciones como enviadas con éxito!`);
    cargarDatos();
  };

  const actualizarEstadoAsistencia = async (idAsistencia, nuevoEstado) => {
    const { error } = await supabase
      .from('asistencia')
      .update({ estado: nuevoEstado })
      .eq('id', idAsistencia);

    if (error) alert('Error al actualizar: ' + error.message);
    else cargarDatos();
  };

  const registrarPagoCuota = async (e) => {
    e.preventDefault();
    if (!pagoRut || !fechaVencimiento) {
      alert('Por favor selecciona un alumno y la fecha de vencimiento.');
      return;
    }

    const { error } = await supabase.from('pagos').insert([
      {
        rut_estudiante: pagoRut,
        mes_cuota: mesCuota,
        fecha_vencimiento: fechaVencimiento,
        pagado: false
      }
    ]);

    if (error) {
      alert('Error al registrar cuota: ' + error.message);
    } else {
      alert('¡Cuota mensual configurada con éxito!');
      setFechaVencimiento('');
      cargarDatos();
    }
  };

  const cambiarEstadoPago = async (idPago, estadoActual) => {
    const { error } = await supabase
      .from('pagos')
      .update({ pagado: !estadoActual })
      .eq('id', idPago);

    if (error) alert('Error al actualizar pago: ' + error.message);
    else cargarDatos();
  };

  const enviarWhatsApp = (telefono, mensaje) => {
    const url = `https://wa.me/${telefono}?text=${encodeURIComponent(mensaje)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <header className="flex justify-between items-center mb-8 border-b border-gray-700 pb-4">
        <h1 className="text-2xl font-bold text-red-500">🥋 Control Total Jiu-Jitsu (Asistencia & Pagos)</h1>
        <div className="space-x-4">
          <button 
            onClick={() => setVista('maestro')} 
            className={`px-4 py-2 rounded font-semibold ${vista === 'maestro' ? 'bg-red-600 text-white' : 'bg-gray-700 text-gray-300'}`}>
            Vista Maestro
          </button>
          <button 
            onClick={() => setVista('alumno')} 
            className={`px-4 py-2 rounded font-semibold ${vista === 'alumno' ? 'bg-red-600 text-white' : 'bg-gray-700 text-gray-300'}`}>
            Vista Alumno
          </button>
        </div>
      </header>

      {vista === 'maestro' ? (
        <div className="space-y-8">
          {/* Formulario Registro o Edición de Usuarios */}
          <div className="bg-gray-800 p-6 rounded-lg shadow-lg border border-gray-700">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-red-400">
                {editandoRut ? `✏️ Editando Usuario: ${editandoRut}` : '1. Registrar Nuevo Alumno o Maestro'}
              </h2>
              {editandoRut && (
                <button onClick={limpiarFormulario} className="bg-gray-600 hover:bg-gray-500 text-white px-3 py-1 rounded text-sm">
                  Cancelar Edición ❌
                </button>
              )}
            </div>
            <form onSubmit={guardarUsuario} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input 
                type="text" 
                placeholder="RUT (Ej: 12.345.678-9)" 
                value={rut} 
                onChange={e => setRut(e.target.value)} 
                disabled={editandoRut !== null} 
                required 
                className="p-2 bg-gray-700 border border-gray-600 rounded text-white disabled:opacity-50" 
              />
              <input type="text" placeholder="Nombre Completo" value={nombre} onChange={e => setNombre(e.target.value)} required className="p-2 bg-gray-700 border border-gray-600 rounded text-white" />
              <input type="date" value={fechaNac} onChange={e => setFechaNac(e.target.value)} className="p-2 bg-gray-700 border border-gray-600 rounded text-white" />
              <input type="text" placeholder="WhatsApp (Ej: 56912345678)" value={whatsapp} onChange={e => setWhatsapp(e.target.value)} required className="p-2 bg-gray-700 border border-gray-600 rounded text-white" />
              <input type="email" placeholder="Correo Electrónico (Opcional)" value={correo} onChange={e => setCorreo(e.target.value)} className="p-2 bg-gray-700 border border-gray-600 rounded text-white" />
              <select value={grado} onChange={e => setGrado(e.target.value)} className="p-2 bg-gray-700 border border-gray-600 rounded text-white">
                <option value="Blanca">Cinto Blanca</option>
                <option value="Azul">Cinto Azul</option>
                <option value="Morada">Cinto Morada</option>
                <option value="Marron">Cinto Marrón</option>
                <option value="Negra">Cinto Negra</option>
              </select>
              <select value={tipoUsuario} onChange={e => setTipoUsuario(e.target.value)} className="p-2 bg-gray-700 border border-gray-600 rounded text-white">
                <option value="alumno">Alumno</option>
                <option value="maestro">Maestro</option>
              </select>
              <button type="submit" className={`md:col-span-2 text-white font-bold p-2 rounded ${editandoRut ? 'bg-amber-600 hover:bg-amber-700' : 'bg-red-600 hover:bg-red-700'}`}>
                {editandoRut ? 'Actualizar Datos del Usuario 🔄' : 'Guardar en Base de Datos 💾'}
              </button>
            </form>
          </div>

          {/* Módulo de Control de Asistencias */}
          <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
            <div className="flex flex-col md:flex-row justify-between items-center mb-4 gap-4">
              <h2 className="text-xl font-semibold text-red-400">2. Control y Registro de Asistencias</h2>
              <div className="space-x-2">
                <button onClick={crearClaseAsistencia} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm font-bold">+ Crear Clase de Hoy</button>
                <button onClick={notificarTodosHoy} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded text-sm font-bold">📢 Notificar Masivo 📱</button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-700 text-gray-400">
                    <th className="p-2">Fecha Clase</th>
                    <th className="p-2">RUT Alumno/Maestro</th>
                    <th className="p-2">Notificación</th>
                    <th className="p-2">Estado Asistencia</th>
                  </tr>
                </thead>
                <tbody>
                  {asistencias.map(a => (
                    <tr key={a.id} className="border-b border-gray-700">
                      <td className="p-2">{a.fecha_clase}</td>
                      <td className="p-2">{a.rut_estudiante}</td>
                      <td className="p-2">
                        {a.notificado ? <span className="bg-green-900 text-green-300 px-2 py-1 rounded text-xs font-bold">Enviada ✅</span> : <span className="bg-yellow-900 text-yellow-300 px-2 py-1 rounded text-xs font-bold">Pendiente ⏳</span>}
                      </td>
                      <td className="p-2 uppercase text-sm font-semibold">
                        {a.estado === 'confirmado' && <span className="text-green-400">Confirmado ✅</span>}
                        {a.estado === 'ausente' && <span className="text-red-400">No Asistirá ❌</span>}
                        {a.estado === 'pendiente' && <span className="text-yellow-400">Pendiente Respuesta ⏳</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Módulo de Pagos y Cuotas Mensuales */}
          <div className="bg-gray-800 p-6 rounded-lg shadow-lg space-y-4">
            <h2 className="text-xl font-semibold text-red-400">3. Calendario y Control de Pagos Mensuales</h2>
            
            <form onSubmit={registrarPagoCuota} className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-gray-750 p-4 rounded border border-gray-700">
              <select value={pagoRut} onChange={e => setPagoRut(e.target.value)} required className="p-2 bg-gray-700 border border-gray-600 rounded text-white">
                <option value="">Seleccionar Alumno</option>
                {usuarios.filter(u => !u.nombre_completo.includes('[INACTIVO]')).map(u => (
                  <option key={u.rut} value={u.rut}>{u.nombre_completo} ({u.rut})</option>
                ))}
              </select>
              <input type="text" placeholder="Mes Cuota (Ej: Septiembre 2026)" value={mesCuota} onChange={e => setMesCuota(e.target.value)} required className="p-2 bg-gray-700 border border-gray-600 rounded text-white" />
              <input type="date" value={fechaVencimiento} onChange={e => setFechaVencimiento(e.target.value)} required className="p-2 bg-gray-700 border border-gray-600 rounded text-white" />
              <button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold p-2 rounded">Configurar Cuota 📅</button>
            </form>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-700 text-gray-400">
                    <th className="p-2">RUT Alumno</th>
                    <th className="p-2">Mes</th>
                    <th className="p-2">Vencimiento</th>
                    <th className="p-2">Estado de Pago</th>
                    <th className="p-2">Acción Alerta WhatsApp</th>
                  </tr>
                </thead>
                <tbody>
                  {pagos.map(p => {
                    const u = usuarios.find(us => us.rut === p.rut_estudiante);
                    return (
                      <tr key={p.id} className="border-b border-gray-700">
                        <td className="p-2">{p.rut_estudiante}</td>
                        <td className="p-2">{p.mes_cuota}</td>
                        <td className="p-2 font-medium text-amber-300">{p.fecha_vencimiento}</td>
                        <td className="p-2">
                          <button 
                            onClick={() => cambiarEstadoPago(p.id, p.pagado)}
                            className={`px-3 py-1 rounded text-xs font-bold ${p.pagado ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
                            {p.pagado ? 'Pagado ✅' : 'Pendiente ❌'}
                          </button>
                        </td>
                        <td className="p-2">
                          <button 
                            onClick={() => {
                              if (u) enviarWhatsApp(u.telefono_whatsapp, `Hola ${u.nombre_completo}, te recordamos que tu cuota de Jiu-Jitsu (${p.mes_cuota}) está próxima a vencer o pendiente (${p.fecha_vencimiento}). ¡Por favor realiza tu pago para mantener activa tu membresía!`);
                            }}
                            className="bg-yellow-600 hover:bg-yellow-700 text-black px-3 py-1 text-sm rounded font-bold">
                            Aviso de Cobro 💰
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Gestión de Usuarios (Modificar / Ocultar / Reactivar) */}
          <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
            <h2 className="text-xl font-semibold mb-4 text-red-400">4. Gestión de Usuarios (Modificar / Ocultar / Reactivar)</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-700 text-gray-400">
                    <th className="p-2">RUT</th>
                    <th className="p-2">Nombre</th>
                    <th className="p-2">Grado</th>
                    <th className="p-2">WhatsApp</th>
                    <th className="p-2">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {usuarios.map(u => {
                    const estaInactivo = u.nombre_completo.includes('[INACTIVO]');
                    return (
                      <tr key={u.rut} className={`border-b border-gray-700 ${estaInactivo ? 'opacity-50' : ''}`}>
                        <td className="p-2">{u.rut}</td>
                        <td className="p-2 font-medium">{u.nombre_completo}</td>
                        <td className="p-2">{u.grado}</td>
                        <td className="p-2">{u.telefono_whatsapp}</td>
                        <td className="p-2 space-x-2">
                          {/* Botón Editar / Modificar */}
                          <button 
                            onClick={() => iniciarEdicion(u)} 
                            className="bg-sky-600 hover:bg-sky-700 text-white px-3 py-1 text-sm rounded font-medium">
                            Editar ✏️
                          </button>

                          {estaInactivo ? (
                            <button onClick={() => toggleEstadoUsuario(u)} className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1 text-sm rounded font-medium">Reactivar 🔄</button>
                          ) : (
                            <button onClick={() => toggleEstadoUsuario(u)} className="bg-red-900 hover:bg-red-800 text-red-200 px-3 py-1 text-sm rounded font-medium">Ocultar 🚫</button>
                          )}
                          <button onClick={() => enviarWhatsApp(u.telefono_whatsapp, `Hola ${u.nombre_completo.replace('[INACTIVO] ', '')}, recordatorio general de cuota de Jiu-Jitsu.`)} className="bg-yellow-600 hover:bg-yellow-700 text-black px-3 py-1 text-sm rounded font-medium">Aviso Pago 💰</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg space-y-6">
          <h2 className="text-xl font-semibold text-red-400">Panel del Alumno</h2>
          <div className="flex gap-4 items-center">
            <input 
              type="text" 
              placeholder="Ingresa tu RUT para ver tus clases" 
              value={rutAlumnoActual} 
              onChange={e => setRutAlumnoActual(e.target.value)} 
              className="p-2 bg-gray-700 border border-gray-600 rounded text-white w-72" 
            />
          </div>

          {rutAlumnoActual && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-300">Tus Asistencias Pendientes y Confirmaciones:</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {asistencias.filter(a => a.rut_estudiante === rutAlumnoActual).map(a => (
                  <div key={a.id} className="bg-gray-700 p-4 rounded flex justify-between items-center">
                    <div>
                      <p className="p-0 font-bold">Clase fecha: {a.fecha_clase}</p>
                      <p className="text-sm text-yellow-300">Estado actual: {a.estado}</p>
                    </div>
                    <div className="space-x-2">
                      <button onClick={() => actualizarEstadoAsistencia(a.id, 'confirmado')} className="bg-green-600 hover:bg-green-700 px-3 py-1 rounded text-sm font-bold">Confirmar ✅</button>
                      <button onClick={() => actualizarEstadoAsistencia(a.id, 'ausente')} className="bg-red-600 hover:bg-red-700 px-3 py-1 rounded text-sm font-bold">No Asistiré ❌</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}