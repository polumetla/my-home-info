import type { Metadata } from "next";
import {
  LTISD_ACCOUNTABILITY_URL,
  LTISD_BUS_ROUTES_URL,
  LTISD_CALENDARS_URL,
  LTISD_DISTRICT_URL,
  LTISD_ENROLLMENT_URL,
  LTISD_FAMILIES_CALENDARS_URL,
  summitAreaSchools,
} from "@/data/schools";

export const metadata: Metadata = {
  title: "Schools",
  description:
    "Lake Travis ISD schools near Summit at Lake Travis—Rough Hollow Elementary, Lake Travis Middle, and Lake Travis High—with calendars, ratings, and official links.",
};

export default function SchoolsPage() {
  return (
    <div className="space-y-10">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">Schools</h1>
        <p className="max-w-2xl text-ink-muted">
          Public schools for many Summit at Lake Travis families are in{" "}
          <a
            href={LTISD_DISTRICT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-accent-dark hover:underline"
          >
            Lake Travis ISD (LTISD)
          </a>
          . Confirm your attendance zone and enrollment rules with the district.
        </p>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h2 className="text-lg font-semibold text-ink">District resources</h2>
        <ul className="mt-4 space-y-3 text-sm text-ink-muted">
          <li>
            <a
              href={LTISD_CALENDARS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-accent-dark hover:underline"
            >
              Instructional &amp; district calendars
            </a>
            <span className="text-slate-500">
              {" "}
              — official LTISD calendar hub (school year, state testing, and district events).
            </span>
          </li>
          <li>
            <a
              href={LTISD_FAMILIES_CALENDARS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-accent-dark hover:underline"
            >
              Families: Calendars
            </a>
            <span className="text-slate-500"> — quick link from the Families section.</span>
          </li>
          <li>
            <a
              href={LTISD_ACCOUNTABILITY_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-accent-dark hover:underline"
            >
              Accountability &amp; ratings (TEA)
            </a>
            <span className="text-slate-500"> — state report cards and district overview.</span>
          </li>
          <li>
            <a
              href={LTISD_ENROLLMENT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-accent-dark hover:underline"
            >
              Enrollment
            </a>
            <span className="text-slate-500"> — new and returning student information.</span>
          </li>
          <li>
            <a
              href={LTISD_BUS_ROUTES_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-accent-dark hover:underline"
            >
              Bus routes
            </a>
          </li>
        </ul>
      </section>

      <div className="space-y-6">
        <h2 className="text-lg font-semibold text-ink">Campus profiles</h2>
        <div className="space-y-6">
          {summitAreaSchools.map((school) => (
            <article
              key={school.name}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-ink">{school.name}</h3>
                  <p className="mt-1 text-sm text-ink-muted">Grades {school.grades}</p>
                </div>
                <div className="flex shrink-0 flex-col items-start gap-1 rounded-xl bg-slate-50 px-4 py-3 sm:items-end">
                  <span className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">
                    GreatSchools
                  </span>
                  <span className="text-2xl font-bold tabular-nums text-ink">
                    {school.greatSchoolsRatingOutOf10}
                    <span className="text-base font-semibold text-slate-500">/10</span>
                  </span>
                  <a
                    href={school.greatSchoolsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-medium text-accent-dark hover:underline"
                  >
                    View profile &amp; methodology
                  </a>
                </div>
              </div>

              <p className="mt-4 text-sm text-ink-muted">{school.address}</p>
              <p className="mt-1 text-sm text-ink-muted">
                <a href={`tel:${school.phone.replace(/\D/g, "")}`} className="hover:underline">
                  {school.phone}
                </a>
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <a
                  href={school.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-accent-dark"
                >
                  Official school site
                </a>
                <a
                  href={school.greatSchoolsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-ink shadow-sm transition hover:border-slate-300"
                >
                  GreatSchools
                </a>
              </div>
            </article>
          ))}
        </div>
      </div>

      <p className="max-w-2xl text-xs leading-relaxed text-slate-500">
        GreatSchools ratings are third-party summaries and can change. Always check{" "}
        <a
          href="https://www.greatschools.org/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent-dark hover:underline"
        >
          GreatSchools
        </a>{" "}
        and{" "}
        <a
          href={LTISD_ACCOUNTABILITY_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent-dark hover:underline"
        >
          TEA / LTISD accountability
        </a>{" "}
        for the latest. Attendance boundaries and feeder patterns are set by LTISD—not this site.
      </p>
    </div>
  );
}
