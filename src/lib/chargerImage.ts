/**
 * Lire une image servie par l'application et la rendre en data URL.
 *
 * jsPDF veut les octets de l'image, pas son adresse : il ne va rien
 * chercher sur le réseau. Une image qui manque ne doit pas pour autant
 * faire échouer le document — on renvoie alors `null`, et l'appelant
 * se passe du logo plutôt que de ne rien sortir du tout.
 */
export async function chargerImage(url: string): Promise<string | null> {
  try {
    const reponse = await fetch(url)
    if (!reponse.ok) return null
    const blob = await reponse.blob()
    return await new Promise<string>((resoudre, rejeter) => {
      const lecteur = new FileReader()
      lecteur.onload = () => resoudre(String(lecteur.result))
      lecteur.onerror = () => rejeter(lecteur.error)
      lecteur.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}
