export function Logo() {
  return <img className="brand-logo" src={new URL("./assets/vanillasky-logo.svg", import.meta.url).href} alt="VanillaSky" width={144} height={36} />;
}
