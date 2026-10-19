/**
 * A section is a placeholder for now: the shell keeps drawing the rings and
 * shows the section title in the heart of the trunk; the page itself only
 * carries a heading for assistive tech.
 */
export const SectionPage = ({ title }: { title: string }) => (
  <h1 className="sr-only">{title}</h1>
);
