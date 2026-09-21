// Formato y validacion de RUT chileno. El digito verificador (DV) se
// calcula con el algoritmo estandar de Modulo 11 -- multiplicar cada
// digito del cuerpo (de derecha a izquierda) por una secuencia ciclica
// 2,3,4,5,6,7,2,3,4..., sumar todo, y el DV es 11 menos el resto de esa
// suma dividida en 11 (con los casos especiales 11 -> "0" y 10 -> "K").

function limpiar(valor) {
    return (valor || "").replace(/[^0-9kK]/g, "").toUpperCase();
}

// Se aplica en cada tecleo (onChange) -- siempre trata el ULTIMO caracter
// como el DV todavia no confirmado, asi que a medida que se sigue
// escribiendo el DV "se corre" solo, sin que el usuario tenga que borrar
// nada. Es el mismo comportamiento que ya usan los formularios de RUT mas
// comunes en sitios chilenos.
export function formatearRut(valor) {
    const limpio = limpiar(valor).slice(0, 9); // 8 digitos de cuerpo + 1 DV, tope real de un RUT chileno
    if (!limpio) return "";
    const cuerpo = limpio.slice(0, -1);
    const dv = limpio.slice(-1);
    if (!cuerpo) return dv;
    const cuerpoFormateado = cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return `${cuerpoFormateado}-${dv}`;
}

function calcularDv(cuerpo) {
    let suma = 0;
    let multiplo = 2;
    for (let i = cuerpo.length - 1; i >= 0; i--) {
        suma += Number(cuerpo[i]) * multiplo;
        multiplo = multiplo === 7 ? 2 : multiplo + 1;
    }
    const resto = 11 - (suma % 11);
    if (resto === 11) return "0";
    if (resto === 10) return "K";
    return String(resto);
}

// Acepta tanto un RUT ya formateado ("12.345.678-5") como uno sin puntos
// ni guion -- limpia primero. Un RUT vacio no se considera invalido aca
// (el campo puede ser opcional segun el form), lo decide quien llama.
export function rutValido(valor) {
    const limpio = limpiar(valor);
    if (limpio.length < 2) return false;
    const cuerpo = limpio.slice(0, -1);
    const dv = limpio.slice(-1);
    if (!/^\d+$/.test(cuerpo)) return false;
    return calcularDv(cuerpo) === dv;
}
