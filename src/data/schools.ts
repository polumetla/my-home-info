/**
 * Lake Travis ISD schools serving Summit at Lake Travis / Rough Hollow area.
 * Verify phone, ratings, and boundaries with LTISD before treating as authoritative.
 */

export type SchoolEntry = {
  name: string;
  grades: string;
  address: string;
  phone: string;
  website: string;
  greatSchoolsUrl: string;
  /** Typical headline rating on GreatSchools (1–10); always confirm on their site. */
  greatSchoolsRatingOutOf10: number;
};

export const LTISD_CALENDARS_URL = "https://www.ltisdschools.org/about/calendars";

export const LTISD_DISTRICT_URL = "https://www.ltisdschools.org/";

export const LTISD_FAMILIES_CALENDARS_URL = "https://www.ltisdschools.org/families";

export const LTISD_ACCOUNTABILITY_URL = "https://www.ltisdschools.org/families/accountability";

export const LTISD_ENROLLMENT_URL = "https://www.ltisdschools.org/families/enrollment";

export const LTISD_BUS_ROUTES_URL = "https://www.ltisdschools.org/families/bus-routes";

export const summitAreaSchools: SchoolEntry[] = [
  {
    name: "Rough Hollow Elementary School",
    grades: "PK–5",
    address: "4219 Bee Creek Road, Spicewood, TX 78669",
    phone: "(737) 931-3000",
    website: "https://rhe.ltisdschools.org/",
    greatSchoolsUrl: "https://www.greatschools.org/texas/austin/25813-NEW-Elementary-School/",
    greatSchoolsRatingOutOf10: 9,
  },
  {
    name: "Lake Travis Middle School",
    grades: "6–8",
    address: "4932 Bee Creek Road, Spicewood, TX 78669",
    phone: "(512) 533-6200",
    website: "https://ltms.ltisdschools.org/",
    greatSchoolsUrl: "https://www.greatschools.org/texas/spicewood/4159-Lake-Travis-Middle-School/",
    greatSchoolsRatingOutOf10: 9,
  },
  {
    name: "Lake Travis High School",
    grades: "9–12",
    address: "3324 Ranch Road 620 South, Austin, TX 78738",
    phone: "(512) 533-6100",
    website: "https://lths.ltisdschools.org/",
    greatSchoolsUrl: "https://www.greatschools.org/texas/austin/4158-Lake-Travis-High-School/",
    greatSchoolsRatingOutOf10: 8,
  },
];
