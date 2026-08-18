import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const metadata = {
  "index.html": {
    title: "Boat Donation Charity | Boats for Charity",
  },
  "thanks.html": {
    description: "We received your boat information for review. Submission is not acceptance, and no timing, value, sale, or tax result is promised.",
  },
  "hin-lookup.html": {
    description: "Decode a boat Hull Identification Number in your browser, learn the HIN's limits, and request a free, nonbinding human-reviewed market estimate.",
  },
  "city/destin/index.html": {
    description: "Prepare a Destin boat donation review with Gulf saltwater condition, ownership, storage, trailer, marina-access, and buyer-pickup details.",
  },
  "city/manchester/index.html": {
    description: "Prepare a Manchester, New Hampshire boat review with winterization, trailer condition, ownership records, storage access, and buyer-pickup facts.",
  },
  "city/santa-barbara/index.html": {
    description: "Prepare a Santa Barbara boat review with Channel exposure, harbor or mooring access, ownership records, condition evidence, and buyer-pickup facts.",
  },
  "boat-donation-by-city/index.html": {
    title: "Boat Donation by City Directory | Boats for Charity",
    description: "Local boat donation preparation for 151 U.S. boating communities, with storage, paperwork, condition, access, and buyer-pickup questions.",
  },
  "boat-donation-by-state.html": {
    description: "Find state-specific boat donation preparation for all 50 states, including ownership records, storage, access, buyer pickup, and review questions.",
  },
  "guides/boat-donation-near-me/index.html": {
    title: "Boat Donation Near Me: Verify Local Options | Boats for Charity",
    description: "Evaluate nearby boat donation options, verify the recipient, test local-presence claims, and understand remote review and buyer-arranged pickup.",
  },
  "guides/boat-donation-paperwork/index.html": {
    title: "Boat Donation Paperwork Checklist | Boats for Charity",
    description: "Organize boat identity, owner authority, liens, trailer records, transfer documents, acknowledgments, and tax records before a donation review.",
  },
  "guides/boat-donation-reviews/index.html": {
    title: "Boat Donation Reviews: Verify Claims | Boats for Charity",
    description: "Read boat donation reviews critically: confirm identity, separate service stages, reject impossible promises, and check authoritative records.",
  },
  "guides/boat-donation-tax-information/index.html": {
    title: "Boat Donation Tax Forms & Records | Boats for Charity",
    description: "Review Form 1098-C, Form 8283, gross-sale-proceeds limits, appraisal exceptions, and current IRS sources with a qualified tax professional.",
  },
  "guides/boat-donation-vs-selling/index.html": {
    title: "Boat Donation vs. Selling Guide | Boats for Charity",
    description: "Compare donating and selling a boat by condition, realistic net proceeds, carrying costs, effort, uncertainty, paperwork, and tax responsibilities.",
  },
  "guides/donate-a-boat-without-a-title/index.html": {
    title: "No-Title Boat Donation Guide | Boats for Charity",
    description: "A missing boat title does not always end an inquiry. Identify the ownership gap, gather evidence, and confirm the state or federal resolution path.",
  },
  "guides/donate-a-non-running-boat/index.html": {
    title: "Donate a Non-Running Boat | Boats for Charity",
    description: "Prepare a non-running boat for individual review with exact engine, hull, storage, trailer, ownership, and buyer-access information.",
  },
  "guides/donate-a-yacht/index.html": {
    title: "Donate a Yacht: Ownership & Transfer | Boats for Charity",
    description: "Prepare a yacht donation inquiry with ownership, lien, condition, marina, owner-custody, buyer-access, and tax-record questions.",
  },
  "guides/donate-an-inherited-boat/index.html": {
    title: "Inherited Boat Donation Checklist | Boats for Charity",
    description: "A checklist for executors, heirs, and trustees to confirm authority, ownership, estate records, consent, storage, and professional guidance.",
  },
  "guides/donation-stories/index.html": {
    title: "Real Boat Donation Story Standards | Boats for Charity",
    description: "See the consent, verification, privacy, context, and practical detail required before Boats for Charity publishes a real donor account.",
  },
  "guides/donation-story-template/index.html": {
    title: "Boat Donation Story Publishing Checklist | Boats for Charity",
    description: "An ethical publishing checklist for story status, consent, privacy, fact-checking, useful detail, honest limits, and correction or withdrawal.",
  },
  "guides/how-to-donate-a-boat/index.html": {
    title: "How to Donate a Boat: Step-by-Step | Boats for Charity",
    description: "Prepare a boat donation request: confirm authority, document condition and access, request review, complete an authorized transfer, and keep records.",
  },
  "guides/junk-boat-removal/index.html": {
    title: "Junk Boat Removal & Donation Limits | Boats for Charity",
    description: "Compare lawful options for a junk, derelict, or abandoned boat, including ownership, hazards, disposal, access, and the limits of donation review.",
  },
  "guides/transparency/index.html": {
    title: "Boat Donation Transparency | Boats for Charity",
    description: "How Boats for Charity reviews each request, what submission does not mean, who keeps custody, how buyer pickup works, and where tax help ends.",
  },
};

const replacements = {
  "city/lake-ozark/index.html": [
    ["The right first step is documenting the boat as it sits today rather than trusting an old listing or memory. Where is it kept, when did it last run, and what shape are the hull, engine, and trailer in? That is what we review. A submission is not acceptance and settles nothing about timing, value, or tax treatment. Every boat is looked at on its own.", "Build a current status sheet for this specific boat: the cove or marina, whether it is in a wet slip, on a lift, or on a trailer, its last launch and winterization history, any facility deadline, and the present hull, engine, and trailer condition. Those facts are weighed together. Sending them starts a review; it is not acceptance and settles nothing about timing, value, or tax treatment."],
    ["Let photos do the work. Cover every side of the hull, the deck, the interior, the helm, the bilge, the engine, and the ID plates, and include corrosion, growth, cracked fiberglass, or missing equipment.", "Photograph the boat in its actual storage setting as well as up close. Include the lift or slip, dock approach, cover, bilge, hull at the waterline, engine compartment, helm, identification plates, and any freeze cracking, water intrusion, mildew, corrosion, or missing gear."],
    ["Give the marina or dock rules, slip or lift location, depth notes, and whether the boat can move under its own power.", "Name the cove, marina, and slip or lift; explain gate and dock access, lift controls, current facility rules, water depth if known, and whether the boat has been operated recently."],
    ["Photograph the trailer VIN plate, frame, tires, hubs, lights, brakes, coupler, and bunks, plus the route out of a steep or tight lot.", "Treat the trailer and the cove road as separate subjects. Show the VIN and registration, tires, hubs, brakes, lights, frame, coupler, bunks, driveway grade, turning space, gate, and surface all the way to the public road."],
    ["Note stands or blocking, lift or forklift needs, ground and gate conditions, facility hours, and any outside-vendor rules.", "For dry storage or a blocked boat, identify the facility contact, rack or stands, launch or loading equipment, appointment requirements, balances, seasonal deadlines, and rules a future buyer or provider would need to follow."],
    ["Transportation is a separate feasibility question: beam, weight, tower height, trailer condition, dock or ramp access, route, and destination all factor in, and length alone decides nothing. Steep cove access and lift storage can complicate a pickup, so a boat here might trailer out, come off a lift with a hauler, or wait in place until a buyer arranges pickup.", "Buyer access around the lake begins with the exact cove and storage arrangement, not mileage alone. Record beam, weight, fixed height, documented trailer condition, lift or ramp requirements, road grade, gate clearance, and marina approvals. After a sale, the buyer decides and arranges any marina-approved operator, service provider, lift appointment, or road transport directly with the owner."],
  ],
  "city/jacksonville/index.html": [
    ["That local picture is context, not a decision. Every boat is reviewed individually, and submitting the form promises nothing about acceptance, permission to move the boat, timing, value, or taxes.", "A St. Johns River, Intracoastal, or ocean-use history changes the questions, not the review standard. Report where the boat was used, any known storm or flood exposure, its exact berth or storage address, and how a buyer could lawfully access it. Submitting those facts is only a review request; it promises no acceptance, movement, timing, value, or tax result."],
    ["Photos tell it best. Shoot every side of the hull, the deck, interior, helm, bilge, engine, ID plates, and anything clearly wrong, corrosion, growth, water intrusion, soft spots, missing gear.", "Use photographs to separate present condition from memory: hull and waterline, running gear, deck, interior, helm, bilge, engine, identification plates, dock lines, and trailer if included. Show salt corrosion, growth, soft areas, water intrusion, storm repairs, and missing equipment rather than summarizing them as normal wear."],
    ["An address doesn't explain whether a boat can come out. Show the whole path, not just the boat, because gates, drives, ramps, current, and marina rules all decide what's workable.", "A Jacksonville address can hide very different access. A downtown river marina, a creek dock, an Intracoastal rack, and a trailer west of town each require different facts. Show the route to the vessel, lawful gate or dock access, facility contact, current or tide constraints the owner knows, and any deadline or balance."],
    ["Marina and dock rules, the slip location, depth, tide, and current at the ramp or lift, how a buyer would get access, and whether she moves under her own power.", "Give the marina or dock contact, berth and gate details, known depth, tide or current limits, keys, facility approvals, and the boat's most recent verified operating status."],
    ["The trailer plate and frame, tires, hubs, lights, coupler, and bunks, plus the actual route out of the yard and onto the road.", "Show the trailer VIN and owner record separately from the hull, then photograph the frame, tires, hubs, brakes, lights, coupler, bunks, gate clearance, surface, and turn onto the public road."],
    ["Stands and blocking, whether a lift or forklift is needed, ground firmness, gate width, and any yard deadline or vendor-approval rule.", "For rack or yard storage, identify who authorizes entry, the rack or blocking arrangement, loading equipment, appointment process, ground and gate limits, balances, deadlines, and outside-provider rules."],
    ["Buyer access is documented separately, since beam, weight, height, trailer roadworthiness, haul-out needs, the route, and destination all matter. Until there's a written plan and the marina confirms its requirements, keep the boat secured and under your control, and don't drop insurance or the slip on an inquiry alone.", "For buyer access, document the vessel's beam, weight, fixed height, verified operating status, trailer condition, launch or haul-out needs, and facility rules. The boat remains secured with the owner during review and sale. Only after cleared payment does the buyer coordinate any captain, service provider, trailer, or other transport directly with the owner and facility."],
  ],
  "city/manchester/index.html": [
    ["Manchester sits on the Merrimack River, but the boating people actually do usually happens elsewhere: Lake Massabesic right on the edge of town, the big draw of Lake Winnipesaukee an hour or so north, and the scattering of smaller southern New Hampshire lakes in between. Because it is a launch-and-retrieve routine, the boat lives on a trailer in a garage or driveway most of the year. Add a genuinely short summer, and it is easy for a rig to go a couple of seasons untouched. When that happens, requesting an individual donation review is one option to give it a second life.", "Manchester owners may use the Merrimack, Lake Massabesic, Lake Winnipesaukee, or smaller southern New Hampshire lakes, but the review begins where the boat is kept now. State whether it is in a garage, driveway, storage yard, seasonal slip, or at a lake property; when it was last launched; and whether the trailer has moved since then. A short boating season can leave long gaps in that history, so mark dates as unknown rather than estimating them."],
    ["That local rhythm helps us picture the boat, but it does not decide acceptance. We review every boat individually; a submission is not acceptance and settles nothing about timing, value, or tax treatment. It just starts the conversation.", "Those local details identify the evidence to collect; they do not predict the decision. Sending information requests an individual review. It does not transfer the boat or promise acceptance, timing, value, sale proceeds, or a tax result."],
    ["The main hazard here is freeze. An engine block or outdrive that was not properly winterized can crack over a New England winter, and a boat stored outside collects snow load, moisture, and sun damage. Tell us when it last ran, how it was winterized, and where you see freeze cracks, corrosion, soft spots, or water intrusion. Then photograph every side of the hull, the deck, the interior and helm, the bilge, the engine, and the ID plates, along with any damage.", "Separate verified maintenance from assumptions. Record the last confirmed engine run, who performed the most recent winterization if known, whether drain plugs and batteries were managed, and whether the cover or shrink-wrap failed. Photograph the block or outdrive, bilge, transom, deck, upholstery, waterline, identification plate, and any snow-load deformation, freeze cracking, corrosion, standing water, or soft material."],
    ["Since almost everything here is trailered, that rig and the path to it are the whole story. Show the gate, the drive, any soft ground, and the route out, and note facility hours if it is in a storage lot.", "Document three separate subjects: the vessel, any included trailer, and the lawful route a future buyer could use after a sale. Include gate width, surface and grade, snow or seasonal access, overhead limits, turning room, facility contacts, balances, deadlines, and entry rules."],
    ["Photograph the coupler, frame, tires, hubs, lights, brakes, and bunks, note the registration and any separate trailer title, and show the route out of the garage or yard.", "Show the trailer VIN and owner record, then the frame, coupler, safety chains, tires, hubs, brakes, lights, and bunks. A parked trailer is not presumed roadworthy; include the driveway, gate, and turn onto the public road."],
    ["If the boat is in the water for the season, give the marina or dock rules, slip location, depth notes, key access, and whether it moves under its own power.", "Name the lake, marina or private dock, berth, facility contact, known depth or ramp constraint, gate or key procedure, and the boat's last verified operating status."],
    ["Explain the stands or blocking, any lift or forklift need, ground conditions, gate width, storage deadlines, and vendor approval rules.", "Identify the yard and unit, blocking or rack arrangement, launch or loading equipment, appointment rules, access surface, outstanding balance, seasonal deadline, and outside-provider policy."],
    ["Match each document to the printed owner and hull number. New Hampshire registration, a trailer title, any lien release, and — if the boat came through an estate or trust — the authority to transfer it all matter. Federally documented vessels go through the Coast Guard's National Vessel Documentation Center; confirm current requirements with whichever applies. The <a href=\"/guides/boat-donation-paperwork/\">paperwork checklist</a> covers the set, and if the boat came to you through a relative, the <a href=\"/guides/donate-an-inherited-boat/\">inherited boat guide</a> speaks to that directly.", "Read the name and identification number from each available record rather than relying on the boat's location. Gather the vessel registration or title, any federal documentation, lien release, trailer record, and estate or trust authority. The agency holding each record determines what is needed to correct a gap. Use the <a href=\"/guides/boat-donation-paperwork/\">paperwork checklist</a>, and consult the <a href=\"/guides/donate-an-inherited-boat/\">inherited-boat guide</a> when the owner of record has died."],
    ["For a buyer arranging pickup after a sale, length alone tells the buyer little. Beam, weight, tower height, trailer roadworthiness, ramp access, and the haul distance to the next stop all factor in, and a rig that has sat through several winters earns a fresh inspection. Until a transfer is genuinely complete, keep the boat secured and keep any storage and insurance current — an inquiry does not move anything.", "The buyer—not Boats for Charity—is responsible for selecting any trailer, marina appointment, launch, service provider, or transport using the documented weight, beam, fixed height, operating status, route, and facility rules. Until ownership has transferred, keep storage, insurance, winter protection, and security in place."],
    ["<h2>A few honest steps</h2><ol><li>Confirm the legal owner and gather the boat and trailer documents you have.</li><li>Photograph condition, ID plates, storage, trailer, and the access route.</li><li>Disclose known damage, freeze cracks, missing gear, liens, and deadlines.</li><li>Send the exact storage location and answer follow-up questions.</li><li>Keep copies of every transfer and acknowledgment for your records.</li></ol>", "<h2>Build a Manchester review packet</h2><ol><li>Copy the owner names and identification numbers exactly from each vessel and trailer record.</li><li>Record the last verified launch, engine run, and winterization rather than guessing.</li><li>Photograph winter exposure, current damage, storage, trailer components, and the complete access route.</li><li>List liens, balances, estate issues, facility contacts, permissions, and deadlines.</li><li>Retain every later acceptance, transfer, agency notice, sale acknowledgment, and tax record.</li></ol>"],
    ["See <a href=\"/state-new-hampshire\">New Hampshire donation information</a> for the state side, and if the engine will not start, the <a href=\"/guides/donate-a-non-running-boat/\">non-running boat guide</a> helps. To see other communities we cover across New England and beyond, start from the <a href=\"/boat-donation-by-city/\">boat donation by city</a> hub.", "Use the <a href=\"/state-new-hampshire\">New Hampshire page</a> for statewide preparation, the <a href=\"/guides/donate-a-non-running-boat/\">non-running boat guide</a> for a confirmed or suspected mechanical problem, or the <a href=\"/boat-donation-by-city/\">city directory</a> when the boat is stored outside the Manchester area."],
  ],
  "city/santa-barbara/index.html": [
    ["A slip in the Santa Barbara harbor is something people wait years for, so an owner who's stopped using their boat often feels the pull to pass it along rather than let it sit.", "A boat in Santa Barbara Harbor, on a mooring, in a yard, or on a trailer presents different condition and buyer-access questions; document the actual setting before requesting review."],
    ["<h2>A small harbor and a long waitlist</h2>", "<h2>Start with the boat's actual harbor setting</h2>"],
    ["Santa Barbara's harbor is compact and beloved, and the slip list is famously long. That creates a particular kind of situation: an owner who no longer sails but keeps the boat mostly because the berth is precious. If you've reached the point where the boat is more obligation than joy, an accepted boat may eventually reach a new owner, and it starts with an honest account of the boat as it sits today rather than how it ran on a clear day out in the Channel.", "Begin with the exact berth, mooring, yard, residence, or storage facility—not a general Santa Barbara location. Record who controls entry, the current operating status, when the boat was last hauled or launched, what equipment is included, and whether any fee, deadline, or facility approval affects access. Those facts let the request be evaluated without assuming the boat can be accepted or moved."],
    ["Boating here centers on the harbor, the moorings, and the Santa Barbara Channel, with open-water exposure to the islands, steady coastal weather, and constant saltwater wear. That context helps us understand your boat, but it doesn't decide anything on its own. We review every boat individually; a submission is not acceptance and settles nothing about timing, value, or tax treatment.", "Use history in the Santa Barbara Channel as condition evidence, not as a conclusion. Disclose offshore use, saltwater immersion, known groundings or storm exposure, time idle, and the maintenance records actually available. Sending the request is not acceptance, permission to relocate the vessel, or a promise about timing, value, sale proceeds, or tax treatment."],
    ["Mild weather and salt water is an easy calendar and a hard environment. Let us know when the boat last ran, when the bottom was last done, and how the salt has treated the running gear, through-hulls, and metal fittings. Growth on the bottom, corroded hardware, blistering, and a tired outdrive or auxiliary are common on boats that sat on their slips. None of it is disqualifying; it just helps us route the boat.", "Report the last verified engine run and bottom service, then describe what is known about through-hulls, seacocks, rigging, running gear, electrical systems, bilge water, corrosion, marine growth, blistering, and water intrusion. Do not call a system operational because it worked on the last trip; state whether it has been tested recently and mark unknowns plainly."],
    ["Photos do a lot of the work. Capture every side of the hull, the deck and cockpit, the cabin, the engine and bilge, and the plate with the hull identification number. Get close on corrosion, blistering, or any soft spots so we're working from the real condition.", "Build a photo sequence that can be followed remotely: the boat in its berth or storage setting, the complete approach, hull and waterline, deck, cockpit, cabin, bilge, engine or auxiliary, running gear if visible, identification plates, and close views of every known defect. Include the mooring, dinghy access, trailer, stands, or lift when applicable."],
    ["A Santa Barbara boat might be in a slip, on a mooring, in the yard, or on a trailer. Each changes what's practical, so show us the full path to the boat.", "Describe lawful access from the public entrance to the vessel. A slip, mooring, blocked hull, and trailered boat require different contacts and equipment, which a future buyer evaluates only after a sale."],
    ["Give the harbor or dock rules, the slip or mooring location, any depth or surge concerns, how access works, and whether the boat can still move under its own power.", "Provide the harbor or mooring contact, berth or field location, key or launch procedure, known depth or surge constraint, dinghy requirements, facility permissions, and last verified operating status."],
    ["Photograph the trailer VIN, frame, tires and hubs, lights, brakes, coupler, and bunks, plus the registration and the route out to the road.", "Treat the trailer as a separate asset. Show its VIN and owner record, frame, coupler, chains, tires, hubs, brakes, lights, and bunks, plus gate clearance, surface, turning room, and the route to the public road. Do not assume roadworthiness."],
    ["Explain the stands or blocking, whether a lift is needed to launch, the ground and gate clearance, and any yard deadlines or vendor rules.", "Name the yard and identify the stands or blocking, loading or launch equipment, appointment requirements, ground and gate limits, balances, deadlines, and rules for outside providers."],
    ["Match every document to the owner and hull number. Larger Channel boats are frequently federally documented rather than state titled, smaller boats carry California DMV registration, the trailer is separate, and a lienholder may still be recorded. Gather the hull identification number, the CF or official documentation number, the owner's name, any lien, the trailer VIN, and any probate, trust, divorce, or business authority. Confirm current requirements with the California DMV or the U.S. Coast Guard National Vessel Documentation Center for a documented vessel.", "Identify which agency holds the vessel record before describing the ownership path. Gather the hull identification number; California registration or title, if any; federal official number and documentation records, if applicable; lien releases; the trailer VIN and record; and any estate, trust, divorce, or business authority. Confirm corrections and transfer requirements with the California DMV or the National Vessel Documentation Center rather than relying on an old bill of sale."],
    ["If the boat is a larger yacht or a loan was never fully cleared, flag it early. Our <a href=\"/guides/donate-a-yacht/\">guide to donating a yacht</a> and the <a href=\"/guides/boat-donation-paperwork/\">paperwork checklist</a> cover what we'll need.", "For a larger vessel, unresolved loan, recorded lien, or missing owner signature, use the <a href=\"/guides/donate-a-yacht/\">yacht guide</a> and <a href=\"/guides/boat-donation-paperwork/\">paperwork checklist</a>. A donation review cannot cure an ownership defect or release a lien."],
    ["Whether a boat can move depends on beam, weight, height, whether it needs a haul-out, the harbor and yard access, and, for a trailered boat, the trailer's condition. A buyer handles those details after a sale, and until a transfer is genuinely underway, keep the boat in its slip or on its mooring, insured, and secured. Don't give up that harbor spot or drop coverage after a first conversation.", "The buyer is responsible for evaluating beam, weight, draft, fixed height, operating status, haul-out needs, trailer condition, route, and destination when selecting a pickup or transport plan. Keep moorage or storage, insurance, security, and facility compliance in place until ownership has transferred."],
    ["<h2>Putting a request together</h2><ol><li>Identify the legal owner and gather the boat and trailer documents you have.</li><li>Take current photos of condition, identification, slip or storage, trailer, and access.</li><li>Disclose known damage, missing gear, liens, unpaid fees, and deadlines.</li><li>Give the exact location and answer follow-up questions.</li><li>Keep copies of every transfer, acknowledgment, and later tax record.</li></ol>", "<h2>Assemble a Santa Barbara review file</h2><ol><li>Copy the legal owner, HIN, registration or official number, lien status, and trailer record exactly.</li><li>Record the berth, mooring, yard, or residence and the facility contact who controls access.</li><li>Photograph the condition, defects, storage setting, approach, and any trailer or loading equipment.</li><li>List balances, approvals, keys, deadlines, storm history, and facts that remain unknown.</li><li>Keep every later decision, transfer instruction, agency notice, acknowledgment, and tax record together.</li></ol>"],
  ],
  "city/wilmington-de/index.html": [
    ["When someone upsizes, downsizes, or moves away, the old boat on the Christina or Delaware River often stays put, and you can compare an individual donation review with a private sale.", "A Wilmington boat may sit on the Christina River, farther down the Delaware, or already hauled inland. The exact berth or storage site matters more than the owner's mailing address."],
    ["<h2>Begin with current facts</h2>", "<h2>Separate river access from storage access</h2>"],
    ["A lot of donations here start with a change: a bigger boat, a smaller one, or a move that leaves the previous boat sitting at the yard. Whatever the reason, a useful review begins with the essentials, the legal owner, the boat's real condition, exactly where it is kept, and honest, realistic access to it.", "Start with the location a buyer would actually encounter: marina berth, private dock, blocked yard space, rack, or residential trailer. Add the name on the vessel record, the present condition, the facility contact, current balances or deadlines, and every fact that remains unknown. Those details make the request reviewable; they do not predict acceptance."],
    ["Boats around Wilmington use the Christina River, the Delaware River, and out toward Delaware Bay, with commercial shipping, real tidal current, winter storage, and bridge routes all part of the picture. That context matters, but it does not decide acceptance. Each submission is only a request for review; it is not acceptance and settles nothing about timing, value, or tax treatment.", "The Christina meets a busy tidal Delaware River near port traffic and fixed infrastructure, while many local boats spend winter well away from the water. Identify the actual route and storage setting instead of borrowing assumptions from a nearby marina. Submission requests an individual review only; it transfers nothing and promises no timing, value, sale, or tax result."],
    ["<h2>Water, climate, and boating season</h2>", "<h2>Tidal-river and winter-layup evidence</h2>"],
    ["Tell us when the boat last ran, what seasonal maintenance was done, and how the weather and water have affected it. On the tidal Delaware, growth, corrosion, and any freeze damage from winter layup are the details worth mentioning first.", "Record the last verified engine run and launch, whether the vessel used salt, brackish, or fresh water, and who performed the most recent winterization if known. Show corrosion and waterline growth, but also freeze cracking, failed covers, standing water, soft material, or storm exposure found after haul-out."],
    ["Photos say it best. Capture every side of the hull, the deck, interior, helm, bilge, engine, ID plates, and any damage, including corrosion, blistering, soft spots, and signs of water intrusion.", "Photograph the vessel in its current setting before taking close-ups. Include the berth or blocking, complete approach, hull and waterline, deck, helm, bilge, engine compartment, identification plates, and every observed defect. Current evidence should replace an old survey or listing description."],
    ["<h2>Storage, trailer, and site access</h2>", "<h2>Christina River berths, upland yards, and trailers</h2>"],
    ["Show the complete path to the boat, not just the hull. Gates, steep drives, soft ground, lifts, racks, ramps, bridge clearances, and marina rules can all determine what is practical along the river.", "Document the lawful path from the public road or dock entrance to the vessel. A river berth can involve gate access, current, depth, bridge or yard constraints, while a boat hauled inland can depend on appointment rules, loading equipment, surface, turning room, and a trailer that has not moved recently."],
    ["Give the marina or dock rules, the slip location, depth or tide notes, how keys or gate access work, and whether the boat can still move under its own power.", "Name the marina or dock, berth, facility contact, gate procedure, known tide or current limits, and the boat's last verified operating status. Note any bridge, ramp, or launch constraint reported by the owner or facility."],
    ["Photograph the trailer VIN plate, frame, tires, hubs, lights, coupler, and bunks, plus its registration and the route from where it sits to the road.", "Treat the trailer as a separate asset. Show its VIN and owner record, frame, coupler, chains, tires, hubs, brakes, lights, bunks, gate clearance, surface, and turn onto the public road. Do not presume roadworthiness from appearance."],
    ["Explain the stands or blocking, any lift or forklift needed, ground conditions, gate width, yard deadlines, and the facility's vendor approval requirements.", "Identify the yard and unit, stands or rack, loading equipment, appointment process, gate and ground limits, current balance, seasonal deadline, and outside-provider rules."],
    ["<h2>Ownership, title, and registration</h2>", "<h2>Trace each record to its issuing agency</h2>"],
    ["The hull and trailer may carry separate titles, registrations, liens, and owners. Gather each record on its own, and do not sign anything until transfer instructions are confirmed. Gaps just call for a closer look.", "Read the owner name and identification number from every available vessel, trailer, lien, estate, or federal-documentation record. A Wilmington storage address does not establish which jurisdiction issued the record, and a donation review cannot correct an ownership gap."],
    ["Have the hull identification number, registration or documentation number, the owner's name, and any lien details ready, plus a note if probate, a trust, a divorce, or a business is involved. Confirm current requirements with the Delaware Division of Fish and Wildlife or the U.S. Coast Guard National Vessel Documentation Center when the boat is documented.", "Gather the HIN, state registration or title if any, federal official number and documentation if applicable, trailer VIN and record, lien releases, and any probate, trust, divorce, or business authority. Confirm a correction or transfer requirement with the agency that holds that specific record, including the Delaware Division of Fish and Wildlife or the National Vessel Documentation Center as applicable."],
    ["For a buyer arranging pickup after a sale, length alone cannot decide movement. Beam, weight, mast or tower height, trailer condition, yard equipment, water access on a busy shipping river, the route, and the destination all matter before the buyer chooses a pickup plan.", "The buyer is responsible for evaluating the vessel's beam, weight, draft, fixed height, operating status, trailer condition, facility approvals, and actual water or road route, and for selecting any captain, yard service, tow, trailer, or other transport. The owner and facility provide only the lawful access they authorize."],
    ["<h2>Prepare a complete request</h2><ol><li>Identify the legal owner and collect the boat and trailer documents you have.</li><li>Take current condition, identification, storage, trailer, and access photos.</li><li>Disclose known damage, missing gear, liens, unpaid fees, and deadlines.</li><li>Send the exact storage location and answer our follow-up questions.</li><li>Keep copies of every transfer, acknowledgment, and later tax record.</li></ol>", "<h2>Build the Wilmington review file</h2><ol><li>Copy the owner names, HIN, registration or official number, lien status, and trailer record exactly.</li><li>Record the berth, yard, rack, or residence and the person who controls lawful access.</li><li>Photograph current condition, identification, storage, approach, and any trailer or loading equipment.</li><li>List balances, appointments, keys, deadlines, prior damage, and facts that remain unknown.</li><li>Retain every later decision, transfer instruction, agency notice, acknowledgment, and tax record.</li></ol>"],
    ["Share the boat's condition, documents, location, storage, trailer, and access, and we will review the request and follow up.", "Send the current river or yard location, ownership records, condition evidence, storage obligations, trailer facts, and lawful access details for an individual review."],
  ],
  "city/virginia-beach/index.html": [
    ["<h2>Begin with current facts</h2>", "<h2>Separate lower-Bay exposure from current condition</h2>"],
    ["Around here the calendar has a way of forcing the question: as storm season approaches, a boat that mostly sits becomes one more thing to protect. If you have landed on donating, the review starts with the essentials, not the geography, the legal owner, the boat's real condition, exactly where it is kept, and how someone would actually reach it.", "Start with the vessel's present berth or storage address, not a general Hampton Roads label. Record the legal owner, last verified use, current condition, facility contact, storm preparations, fees or deadlines, and the lawful approach a future buyer could use. Those details make the request reviewable; they do not predict acceptance."],
    ["Boats work the Lynnhaven, Chesapeake Bay, and the Atlantic just outside the inlets, with military zones, tides, and storm exposure all part of the picture. That context is useful, but it does not decide acceptance. Each submission is only a request for review; it is not acceptance and settles nothing about timing, value, or tax treatment.", "A Lynnhaven-area slip, a rack near an inlet, and a trailered boat inland carry different exposure and access facts. Identify where the boat actually operated, saltwater use, known flooding or storm damage, and any navigation or facility restriction the owner knows. Submission requests an individual review only; it transfers nothing and promises no timing, value, sale, or tax result."],
    ["<h2>Water, climate, and boating season</h2>", "<h2>Document salt and storm exposure</h2>"],
    ["Salt and storms drive condition here. Tell us the last time the boat ran, how it was prepared for winter or a blow, and what sun, salt, wind, or flooding have done to it. Corrosion, blistering, and any storm damage are the first things to mention.", "Record the last verified engine run, haul-out, bottom service, and storm preparation. Report corrosion, blistering, marine growth, water intrusion, electrical or bilge problems, and any wind, surge, flooding, or collision damage. Separate observed condition from assumptions."],
    ["Photos make the difference. Capture every side of the hull, the deck, interior, helm, bilge, engine, ID plates, and any damage, including growth at the waterline, corrosion, and signs of prior flooding or collision.", "Photograph the complete vessel in place before taking detail views. Include the berth, rack, yard, or trailer; the full approach; hull and waterline; deck; helm; bilge; engine compartment; identification plates; and every known defect or prior repair."],
    ["<h2>Storage, trailer, and site access</h2>", "<h2>Lynnhaven berths, racks, and trailer routes</h2>"],
    ["Show the whole path to the boat, not just the hull. Gates, steep drives, soft ground, lifts, racks, ramps, bridge clearances, and marina rules can all decide what is practical here.", "Document entry from the public road or marina gate to the vessel. Include keys and permissions, dock or rack position, ramp or lift needs, gate and overhead clearance, surface and turning room, balances, deadlines, and any rule for outside providers."],
    ["Give the marina or dock rules, the slip location, depth or tide notes, how keys or gate access work, and whether the boat can still move under its own power.", "Name the marina or dock, berth, facility contact, gate procedure, known depth or tide constraint, required approval, and the boat's last verified operating status."],
    ["Photograph the trailer VIN plate, frame, tires, hubs, lights, coupler, and bunks, plus its registration and the route from where it sits to the road.", "Show the trailer VIN and owner record, frame, coupler, chains, tires, hubs, brakes, lights, and bunks, then show the gate, surface, and turn onto the public road. Report last road use and known defects without presuming roadworthiness."],
    ["Explain the stands or blocking, any lift or forklift needed, ground conditions, gate width, yard deadlines, and the facility's vendor approval requirements.", "Identify the yard or rack, blocking, loading equipment, appointment process, gate and ground limits, current balance, storm or seasonal deadline, and outside-provider rules."],
    ["<h2>Ownership, title, and registration</h2>", "<h2>Match Virginia and federal ownership records</h2>"],
    ["Collect the title, registration, any lien release, a bill of sale, and estate or trust authority if the boat came to you that way. Keep the trailer's records with the rest. Missing pieces may prevent transfer; the issuing agency determines whether a correction is available.", "Inventory the vessel, trailer, lien, and authority records separately. Copy the printed owner and identification number from each, identify the issuing agency, and mark every missing signature or release. A Virginia Beach storage address does not correct an ownership gap or establish authority to transfer."],
    ["Have the hull identification number, registration or documentation number, the owner's name, and any lien details ready, plus a note if probate, a trust, a divorce, or a business is involved. Confirm current requirements with the Virginia Department of Wildlife Resources or the U.S. Coast Guard National Vessel Documentation Center when the boat is documented.", "Gather the HIN, Virginia registration or title record if applicable, federal official number and documentation if applicable, trailer VIN and record, lien releases, and any probate, trust, divorce, or business authority. Confirm a correction or transfer requirement with the Virginia Department of Wildlife Resources or the National Vessel Documentation Center according to the record involved."],
    ["For a buyer arranging pickup after a sale, length alone cannot decide movement. Beam, weight, mast or tower height, trailer condition, yard equipment, water access, the route, and the destination all matter before the buyer chooses a pickup plan.", "After a sale, the buyer evaluates beam, weight, draft, fixed height, verified operating status, trailer condition, facility approvals, and the actual water or road route, then selects any captain, yard service, trailer, or other transport directly with the owner and facility."],
    ["Do not cancel storage, insurance, or security based on an inquiry. Keep the boat under your control until written transfer steps are done and the marina or yard confirms what it needs.", "Until ownership has transferred, keep the slip, rack, yard space, insurance, security, and required storm preparation current. A submission or follow-up conversation is not a handoff."],
    ["<h2>Prepare a complete request</h2><ol><li>Identify the legal owner and collect the boat and trailer documents you have.</li><li>Take current condition, identification, storage, trailer, and access photos.</li><li>Disclose known damage, missing gear, liens, unpaid fees, and deadlines.</li><li>Send the exact storage location and answer our follow-up questions.</li><li>Keep copies of every transfer, acknowledgment, and later tax record.</li></ol>", "<h2>Build the Virginia Beach review file</h2><ol><li>Copy the legal owner, HIN, Virginia registration or official number, lien status, and trailer record exactly.</li><li>Record the current slip, rack, yard, or residence and the contact who controls lawful access.</li><li>Photograph salt and storm condition, identification, storage, the complete approach, and any trailer or loading equipment.</li><li>List facility rules, keys, balances, deadlines, storm exposure, prior repairs, and facts that remain unknown.</li><li>Retain every later decision, acceptance, transfer instruction, agency notice, acknowledgment, and tax record.</li></ol>"],
  ],
  "guides/how-to-donate-a-boat/index.html": [
    ["If the boat is a good fit, you follow the transfer instructions, sign the ownership over cleanly, and keep the paperwork you will need at tax time.", "If you receive written acceptance, follow the authorized transfer instructions for that boat and keep the completed ownership and tax records."],
    ["It is more accurate to think of it as a transfer of real property that happens to go to a charitable cause.", "It is more accurate to think of it as a legally documented charitable gift involving titled personal property."],
    ["This is common and completely reasonable to donate, but the fees do not stop simply because you have made an inquiry.", "This is a common reason to explore donation, but the fees do not stop simply because you have made an inquiry."],
    ["<strong>A clean, straightforward boat.</strong> Clear title, known condition, easy access. These move most smoothly, and the steps below are all you need.", "<strong>A boat with fewer unknowns.</strong> Clear ownership records, documented condition, and usable access reduce follow-up questions, but the request still receives an individual review."],
    ["If the boat is a fit, sign the ownership over exactly as directed. Keep keys, insurance, storage, and security in place until that process is clearly underway.", "If you receive written acceptance, sign the ownership over exactly as directed. Keep keys, insurance, storage, and security in place until ownership has transferred and required notices are complete."],
    ["Because the facts are clear and access is easy, the review is uncomplicated, and the donor's main job afterward is signing the title over and filing the acknowledgment.", "Because the facts are clear and access is documented, the review has fewer unknowns. If the boat is accepted, the donor then follows the written transfer instructions and keeps the acknowledgment."],
    ["Noncash gifts over $500 generally involve IRS Form 8283, and higher-value property may require a qualified appraisal. Confirm what applies to you with a qualified tax professional and review IRS Publications 526 and 561.", "A noncash deduction over $500 generally requires Form 8283. Gifts above $5,000 often require Section B and a qualified appraisal, but a qualified vehicle limited to gross sale proceeds is reported in Section A—even above $5,000—when the donor has the required acknowledgment. Confirm your facts with a qualified tax professional and current IRS instructions."],
  ],
  "guides/boat-donation-vs-selling/index.html": [
    ["Donation removes the marketing burden entirely, though acceptance still depends on review of the same realities: condition, documents, access, and marketability.", "If a request is accepted and the authorized transfer is completed, the donation route removes the owner's private-sale marketing work. Acceptance still depends on condition, documents, access, and marketability."],
    ["Donation can be a simpler close once authority to transfer is clear.", "After authority to transfer is clear, donation may be worth comparing with a private sale; neither route is automatic."],
    ["If the likely sale price is modest, carrying costs can erase it. Donation stops the meter sooner in many cases.", "If the likely sale price is modest, carrying costs can erase it. A donation inquiry does not stop those costs, so compare both routes without assuming either timeline."],
    ["Donation is often a cleaner exit than a long, low-offer listing.", "Donation may be worth reviewing alongside a long, low-offer listing, but condition and access can still lead to a decline."],
    ["Resolving it — or choosing a donation path built to handle it — keeps you out of an abandoned-property bind.", "Resolving the ownership gap is necessary before either a private sale or an authorized donation transfer can be completed."],
    ["Donation also needs clean transfer and records, but shifts the buyer-hunting off your plate.", "Donation also needs clean transfer and records; only an accepted and completed donation shifts the buyer-search work away from the owner."],
    ["Here donation is often the cleaner outcome, and the owner can ask a tax professional whether a deduction adds value on top.", "Here a donation review may be worth requesting, but the outcome is not known until the condition, ownership, and access facts are assessed. A tax professional can separately explain whether a completed gift would affect the owner's return."],
    ["Donating removes the marketing burden and can support a charitable deduction if you qualify, though acceptance and tax outcomes are never guaranteed.", "An accepted and completed donation removes the owner's private-sale marketing work and may support a charitable deduction if the donor qualifies; acceptance and tax outcomes are never guaranteed."],
    ["Donation can be a cleaner exit, but acceptance still depends on review of condition, documents, and access.", "Donation may be worth reviewing, but acceptance still depends on condition, documents, and access."],
    ["Use our free <a href=\"/hin-lookup\">boat HIN lookup and boat value request</a> to decode the hull identification number and ask our team for a human-reviewed estimated market range.", "Use our free <a href=\"/hin-lookup\">boat HIN lookup and optional value request</a> to decode the hull identification number and request a human-reviewed estimate. An estimate is not acceptance, a sale-price promise, an appraisal, or a tax value."],
  ],
  "guides/donate-a-non-running-boat/index.html": [
    ["Yes, a boat that does not run can often still be donated, and no, you do not need to repair it first.", "A boat that does not run can be submitted for individual review, and you do not need to repair it just to make an inquiry."],
    ["Often, yes. A boat that will not start can still be a workable donation, but the decision depends on condition, ownership, location, and access considered together.", "You may submit it for review. Whether a boat that will not start is workable depends on condition, ownership, location, and access considered together."],
  ],
  "guides/boat-donation-paperwork/index.html": [
    ["The hull's paperwork does not transfer the trailer, and a roadworthy hull does not make an unsafe or undocumented trailer legal to tow.", "The hull's paperwork does not transfer the trailer, and a sound hull does not make an unsafe or undocumented trailer legal to tow."],
    ["Get those in order and a donation moves cleanly. Miss one, most often the trailer or a lien, and it stalls.", "Organizing those records reduces uncertainty. A missing trailer record, lien release, or authority document can prevent an authorized transfer."],
    ["It also lets a review move quickly, because the facts are already documented instead of reconstructed by phone.", "It also makes a review more grounded because the facts are documented instead of reconstructed from memory."],
    ["Money owed against the boat travels with it.", "Liens and unpaid balances can affect whether and how ownership may be transferred."],
    ["This is what you create at handover and keep.", "If the request is accepted, this is the file created during the authorized transfer and retained afterward."],
    ["Many states let a former owner file a release-of-liability notice; doing so is one of the most valuable protective steps available to you.", "Some jurisdictions provide a notice of transfer, release of liability, or registration-cancellation process. Confirm whether one applies with the agency that holds the record."],
    ["Noncash gifts over $500 generally involve IRS Form 8283, and higher-value property may require a qualified appraisal.", "A noncash deduction over $500 generally requires IRS Form 8283. Gifts above $5,000 often require Section B and a qualified appraisal, but the current instructions provide a Section A exception for a qualified vehicle limited to gross sale proceeds when the donor has the required acknowledgment."],
    ["At handover they sign the title assignment, keep a copy, and file a release-of-liability notice with the state (File 5). Afterward they file the acknowledgment with their tax records (File 6). Six files, in order, no surprises.", "If accepted, they follow the written transfer instructions, keep a copy, and complete any notice the issuing agency requires (File 5). Afterward they retain the acknowledgment with their tax records (File 6). The example shows how the files relate; actual requirements vary."],
    ["Missing trailer paperwork is one of the most common reasons a transfer stalls.", "Missing trailer paperwork can prevent the trailer from transferring with the boat."],
    ["If your state offers one, use it. It is your proof that responsibility for the boat ended when you transferred it.", "If the issuing agency offers one, confirm when and how to file it. Keep the resulting record with the signed transfer documents."],
    ["Noncash gifts over $500 generally involve IRS Form 8283, and higher-value property may require a qualified appraisal under the rules in IRS Publications 526 and 561.", "A noncash deduction over $500 generally requires Form 8283. Gifts above $5,000 often require Section B and a qualified appraisal, but a qualified vehicle limited to gross sale proceeds can remain in Section A when the current instructions and acknowledgment requirements are met."],
  ],
  "guides/donate-an-inherited-boat/index.html": [
    ["A death certificate alone usually does not establish transfer authority.", "A death certificate alone may not establish transfer authority."],
    ["<strong>Submit and transfer.</strong> Share the authority documents and records for review, then complete the transfer, notify the titling authority, and keep everything for tax purposes.", "<strong>Submit, then wait for a decision.</strong> Share the authority documents and records for review. Only after written acceptance should the authorized signer follow the transfer instructions, complete required notices, and retain the records."],
    ["gets all three siblings to sign a short written agreement to donate", "documents whatever consents the family's attorney says are required"],
    ["Whether the boat can move before probate concludes is a legal question, not a boat question.", "Whether the boat may be legally transferred before probate concludes is a legal question, not a boat question."],
  ],
  "guides/donate-a-yacht/index.html": [
    ["None of this makes a yacht impossible to donate. It just means the facts need to be established before assumptions are made, so that everyone is working from the same picture.", "None of those facts decides acceptance by itself. Together they show what must be established before an individual decision can be made."],
    ["<strong>Handle the paperwork.</strong> Complete the transfer, notify the titling or documentation authority, and keep everything for your tax records.", "<strong>Handle the paperwork only after acceptance.</strong> Follow the written transfer instructions, notify the applicable titling or documentation authority, and keep the completed records for your tax file."],
    ["Noncash gifts over $500 generally involve Form 8283, and larger claimed values may require a qualified appraisal and, when issued, a Form 1098-C.", "A noncash deduction over $500 generally requires Form 8283. Gifts above $5,000 often require Section B and a qualified appraisal, but the current instructions provide a Section A exception for a qualified vehicle limited to gross sale proceeds when the donor has the required acknowledgment. Form 1098-C is a separate qualified-vehicle acknowledgment governed by the transaction facts."],
  ],
  "guides/donate-a-jet-ski/index.html": [
    ["<strong>Complete the transfer.</strong> Sign over ownership, notify your state agency, and keep records for taxes.", "<strong>Transfer only after written acceptance.</strong> Follow the authorized instructions, complete any required agency notice, and keep the signed transfer and tax records."],
  ],
  "guides/donate-a-boat-without-a-title/index.html": [
    ["A lost certificate is often replaceable.", "A lost certificate may be replaceable through the issuing agency."],
    ["This is usually the most solvable case: most states issue a duplicate or replacement title to the listed owner.", "The issuing agency may offer a duplicate or replacement document to the owner of record; requirements vary."],
    ["For a state-titled or registration-only boat, that is your state boating or titling agency and DMV; ask about duplicate, replacement, and bonded-title paths.", "For a state-titled or registration-only boat, contact the agency that holds the vessel record and ask which duplicate, replacement, or other ownership process applies."],
    ["The donation becomes an ordinary titled transfer once the paper is restored.", "Once the record is restored, the ownership gap may become an ordinary title-transfer question; acceptance remains a separate review decision."],
  ],
  "guides/boat-donation-near-me/index.html": [
    ["What matters is who reviews your boat, who takes legal ownership, and who handles the sale or disposition afterward.", "What matters is who reviews your boat, which charity authorizes and documents the donation, and how any later ownership transfer or disposition is handled."],
    ["Who receives ownership? Who reviews the boat? Does the charity provide transportation, or does a buyer arrange it directly after a sale?", "Who reviews the boat? Which charity is the donation recipient? How is a later ownership transfer documented? Does the charity provide transportation, or does a buyer arrange it directly after a sale?"],
    ["Who reviews, who receives ownership, who manages disposition, and whether the buyer—not the charity—arranges pickup after a sale.", "Who reviews, which charity authorizes the donation, how ownership transfer is documented, who manages disposition, and whether the buyer—not the charity—arranges pickup after a sale."],
    ["What matters is who actually reviews your boat, who receives legal ownership, and who manages the sale or disposition.", "What matters is who actually reviews your boat, which charity authorizes and documents the donation, and how the sale, disposition, and ownership transfer are handled."],
    ["Because the review is remote, the quality of the information you give is what moves it forward. Vague inputs slow it down; clear photos and exact numbers speed it up.", "Because the review is remote, the quality of the information matters. Vague inputs leave questions; clear photographs and exact numbers make the facts easier to assess without promising a timeline."],
    ["For documented vessels, the U.S. Coast Guard National Vessel Documentation Center is the transfer authority, and your state boating agency and DMV handle titled boats.", "For documented vessels, confirm transfer requirements with the U.S. Coast Guard National Vessel Documentation Center. For other vessels, use the state agency that holds the title or registration record."],
  ],
  "guides/transparency/index.html": [
    ["Keep the boat and trailer secure and keep obligations current until the handoff is finished.", "Keep the boat and trailer secure and keep obligations current until the authorized transfer is finished."],
    ["Disclosing a problem does not disqualify a boat; many workable donations start with a candid list of what is wrong. Concealing a problem is what stops a transfer, usually at the worst possible moment.", "Disclosing a problem does not decide the outcome by itself; it lets the facts be reviewed honestly. Concealing one can undermine or stop a transfer later."],
    ["Disclosing a problem does not disqualify a boat. Hiding one wastes everyone's time and can stop a transfer later.", "Disclosing a problem does not decide the outcome by itself. Hiding one wastes time and can stop a transfer later."],
  ],
  "guides/junk-boat-removal/index.html": [
    ["Boats for Charity will tell you plainly rather than string you along, and no acceptance or timing is promised in advance, and Boats for Charity does not provide pickup or removal.", "The individual review considers those facts without promising acceptance or timing. Boats for Charity does not provide pickup, removal, transportation, or storage."],
  ],
  "guides/boat-donation-reviews/index.html": [
    ["the charity that receives ownership", "the charity that receives the donation request and authorizes any charitable transfer"],
    ["<li><strong>Marina coordination</strong> — arranging access, deadlines, and release from a facility.</li>", "<li><strong>Facility requirements</strong> — access, deadlines, balances, and release rules at a marina or yard.</li>"],
  ],
};

const siteWideReplacements = [
  ["<span class=\"trust-num\">🚤</span>", "<span class=\"trust-num\">1</span>"],
  ["<span class=\"trust-num\">🏠</span>", "<span class=\"trust-num\">2</span>"],
  ["<span class=\"trust-num\">🤝</span>", "<span class=\"trust-num\">3</span>"],
  ["<span class=\"trust-num\">📄</span>", "<span class=\"trust-num\">4</span>"],
  ["📞 ", ""],
  ["🚤 ", ""],
  ["✅ ", ""],
  ["Submit My Boat for Review", "Request My Review"],
  ["Request My Boat Review", "Request My Review"],
  ["Buyer pickup is evaluated separately from the donation review. After a sale and cleared payment, the buyer—not Boats for Charity—chooses and coordinates any trailer, marina appointment, launch, service provider, or transport using the documented weight, beam, fixed height, operating status, route, and facility rules. Until ownership has transferred, keep storage, insurance, winter protection, and security in place.", "The buyer—not Boats for Charity—is responsible for selecting any trailer, marina appointment, launch, service provider, or transport using the documented weight, beam, fixed height, operating status, route, and facility rules. Until ownership has transferred, keep storage, insurance, winter protection, and security in place."],
  ["Buyer pickup is a later, separate feasibility decision. After a sale and cleared payment, the buyer coordinates directly with the owner and any facility using the vessel's beam, weight, draft, fixed height, operating status, haul-out needs, trailer condition, route, and destination. Keep moorage or storage, insurance, security, and facility compliance in place until ownership has transferred.", "The buyer is responsible for evaluating beam, weight, draft, fixed height, operating status, haul-out needs, trailer condition, route, and destination when selecting a pickup or transport plan. Keep moorage or storage, insurance, security, and facility compliance in place until ownership has transferred."],
  ["After cleared payment, a buyer evaluates the vessel's beam, weight, draft, fixed height, operating status, trailer condition, facility approvals, and the actual water or road route. The buyer then coordinates any captain, yard service, tow, trailer, or other transport directly with the owner and facility.", "The buyer is responsible for evaluating the vessel's beam, weight, draft, fixed height, operating status, trailer condition, facility approvals, and actual water or road route, and for selecting any captain, yard service, tow, trailer, or other transport. The owner and facility provide only the lawful access they authorize."],
  ["You may submit it for individual review. A non-running boat can be submitted for individual review, but submission is not acceptance. State when it last ran, whether it is in a berth, at anchor, hauled, or trailered, and what is known about the hull, engine, rigging, bilge, and access.", "You may submit it for individual review, but submission is not acceptance. State when it last ran, whether it is in a berth, at anchor, hauled, or trailered, and what is known about the hull, engine, rigging, bilge, and access."],
  ["After a sale, the buyer coordinates directly with the owner.", "After a sale and cleared payment, the buyer coordinates directly with the owner."],
  [", and the buyer works them out directly with the owner after a sale.", "; the buyer resolves those details directly with the owner."],
  [", and the buyer settles them directly with the owner after a sale.", "; the buyer resolves those details directly with the owner."],
  ["the buyer evaluates transport directly with the owner after a sale.", "the buyer evaluates transport directly with the owner at that stage."],
  ["A buyer evaluates those details after a sale,", "The buyer evaluates those details at that stage,"],
  ["until the transfer is signed", "until ownership has transferred and any facility has confirmed its release requirements"],
  ["until ownership has transferred and the facility confirms its release requirements", "until ownership has transferred and any facility has confirmed its release requirements"],
  ["An honest set of pictures moves things along.", "An honest set of pictures gives the review better evidence."],
  ["and clear pictures move things along.", "and clear pictures give the review better evidence."],
  ["donating is worth considering", "requesting an individual donation review is one option"],
  ["donating is worth a look", "requesting an individual donation review is one option"],
  ["donation is worth a look", "an individual donation review is one option"],
  ["donation is worth thinking through", "an individual donation review is one option to compare"],
  ["donation is worth thinking about", "an individual donation review is one option to consider"],
  ["donating is worth thinking about", "requesting an individual donation review is one option"],
  ["It just helps to describe it plainly so the review reflects the boat as it sits today, not how it looked the last time it ran clean.", "Describe current observations plainly and distinguish them from the boat's last known clean run."],
  ["None of it is disqualifying; it just helps us route the boat honestly.", "No single condition fact decides the outcome; disclose each one so the individual review can assess the whole boat."],
  ["what still qualifies", "what facts matter in review"],
  ["If something is missing, that is a solvable problem, not a dead end,", "If something is missing, it may prevent transfer; the issuing agency determines whether it can be corrected,"],
  ["Anything missing just means a closer look, not a dead end.", "A missing record can prevent transfer; the issuing agency determines whether a correction is available."],
  ["If something is missing, say so; that's a normal starting point, not a dead end.", "If something is missing, identify the gap; the issuing agency determines whether it can be corrected and whether transfer is possible."],
  ["and that alone rules nothing out.", "and engine status alone does not decide acceptance."],
  ["and that alone does not rule anything out.", "and engine status alone does not decide acceptance."],
  ["and that does not rule anything out.", "and engine status alone does not decide acceptance."],
  ["Photograph the trailer VIN, frame, tires, hubs, lights, coupler, and bunks, and confirm whether the registration is current and the rig is roadworthy after sitting through a winter.", "Photograph the trailer VIN, frame, tires, hubs, brakes, lights, coupler, and bunks. Note the registration status and any known defect; a qualified person should assess roadworthiness before a tow."],
  ["Photograph the trailer VIN, frame, tires, hubs, lights, coupler, and bunks, and confirm whether the registration is current and the rig is roadworthy enough to tow off the property.", "Photograph the trailer VIN, frame, tires, hubs, brakes, lights, coupler, and bunks. Note the registration status and any known defect; a qualified person should assess roadworthiness before a tow."],
  ["We'll explain the next step for your situation rather than guess.", "The agency holding each record determines the correction path; the review can identify which facts remain incomplete."],
  ["We will walk through it rather than turn you away over a lost document.", "A missing document does not prevent an inquiry, but the agency holding the record determines whether correction is possible."],
  ["We will walk through it with you.", "The agency holding each record determines the correction path; the review can identify which facts remain incomplete."],
  ["We will sort through it with you.", "The agency holding each record determines the correction path; the review can identify which facts remain incomplete."],
  ["We'll point you to the right path once we know the details.", "The agency holding each record determines the correction path; the review can identify which facts remain incomplete."],
  ["We'll point you to the right path once we know the specifics.", "The agency holding each record determines the correction path; the review can identify which facts remain incomplete."],
  ["We will walk through it before anything is signed.", "The agency holding each record determines the correction path; do not sign anything until the authorized transfer instructions are clear."],
  ["We will walk you through it.", "The probate professional and agency holding each record determine the required authority and correction path."],
  ["Not automatically. Write down what you have and what is missing.", "You may submit the known facts for review, but a missing ownership record can prevent transfer. Write down what exists and what is missing."],
  ["We will steer you to the right path instead of guessing.", "The agency holding each record determines the correction path; the review can identify which facts remain incomplete."],
  ["We will point you to the correct path rather than guess.", "The agency holding each record determines the correction path; the review can identify which facts remain incomplete."],
  ["We will steer you to the correct path rather than guess.", "The agency holding each record determines the correction path; the review can identify which facts remain incomplete."],
  ["We'll point you to what a review needs.", "The review can identify missing facts; the issuing agency controls any record correction."],
  ["We'll tell you what a review needs.", "The review can identify missing facts; the issuing agency controls any record correction."],
  ["We'll explain what a review needs.", "The review can identify missing facts; the issuing agency controls any record correction."],
  ["we'll explain what a review needs.", "the review can identify missing facts; the issuing agency controls any record correction."],
  ["We'll point you to what the state needs before anything transfers.", "The North Carolina agency holding each record determines the required evidence before transfer."],
  ["If you want a sense of what still qualifies, our guide to donating a non-running boat covers the common situations.", "For the facts relevant to a non-running-boat review, use our guide to donating a non-running boat."],
  ["We will help you sort it rather than stop at a missing title.", "The agency holding the record determines the correction path; the review can identify which facts remain incomplete."],
  ["We will point you toward what to sort out.", "The agency holding the record determines the correction path; the review can identify which facts remain incomplete."],
  ["We will help you figure out what to track down.", "The agency holding the record determines the correction path; the review can identify which facts remain incomplete."],
  ["We will point you toward the correct path once we know the specifics.", "The agency holding the record determines the correction path; the review can identify which facts remain incomplete."],
  ["We will point you toward what usually closes each gap.", "The agency holding the record determines whether and how each gap may be corrected."],
  ["We will point you toward the correct path rather than guess.", "The agency holding the record determines the correction path; the review can identify which facts remain incomplete."],
  ["We will help you find the correct path rather than guess.", "The agency holding the record determines the correction path; the review can identify which facts remain incomplete."],
  ["We will help you find the right path.", "The agency holding the record determines the correction path; the review can identify which facts remain incomplete."],
  ["We will point you to the correct next step rather than guess.", "The agency holding the record determines the correction path; the review can identify which facts remain incomplete."],
  ["We will point you in the right direction from there.", "The agency holding the record determines the correction path; the review can identify which facts remain incomplete."],
  ["We will point you to the correct path from there.", "The agency holding the record determines the correction path; the review can identify which facts remain incomplete."],
  ["We will help you sort out the order.", "The agency holding each record determines the correction order; the review can identify which facts remain incomplete."],
  ["We will point you to what is typically needed rather than guess at your situation.", "The agency holding each record determines the required evidence and whether a correction is available."],
  ["We will tell you what typically applies.", "The agency holding each record determines what applies and whether a correction is available."],
  ["We will explain what typically applies.", "The agency holding each record determines what applies and whether a correction is available."],
  ["If a document is missing, that is common and workable.", "If a document is missing, it may or may not be correctable; the agency holding the record controls that process."],
  ["If something is missing, that is common and workable; it just means a closer look at your specific situation.", "If something is missing, it may or may not be correctable; the agency holding that record determines the available process."],
  ["Does a winterized or shrink-wrapped boat still qualify?", "Can a winterized or shrink-wrapped boat be submitted for review?"],
  ["It can. A boat on the hard for the season is common here. Let us know the yard, whether it is blocked on stands or shrink-wrapped, and any deadline the storage facility has set for the spot.", "Yes, it can be submitted for individual review. State the yard, blocking or stands, wrap condition, access rules, and any facility deadline. Seasonal storage does not predict acceptance."],
  ["Every boat is reviewed on its own facts, and a non-running boat is never an automatic no.", "Every boat is reviewed on its own facts, and engine status alone does not decide acceptance."],
  ["Missing documents call for a closer look, not an automatic no.", "Missing documents may prevent transfer; the issuing agency determines whether a correction is available."],
  ["Missing pieces need a closer look, not an automatic no.", "Missing pieces may prevent transfer; the issuing agency determines whether a correction is available."],
  ["Missing documents mean a closer look, not an automatic no.", "Missing documents may prevent transfer; the issuing agency determines whether a correction is available."],
  ["Many boats here already sit on a roadworthy trailer, but that gets confirmed in review — a boat might trailer out, need a hauler, or wait in place until a buyer arranges pickup.", "Do not assume a parked trailer is roadworthy. After a sale, the buyer evaluates the records, condition, route, and service needs and arranges any trailer, hauler, or other pickup directly with the owner."],
  ["Photograph the trailer VIN plate, frame, tires, hubs, lights, coupler, and bunks, confirm it is roadworthy, and show the route out to a street a truck can reach.", "Photograph the trailer VIN plate, frame, tires, hubs, brakes, lights, coupler, and bunks; report what has and has not been inspected, and show the route to the public road without assuming roadworthiness."],
  ["Photograph the trailer VIN, frame, tires, hubs, lights, coupler, and bunks, and confirm whether it is roadworthy for a long tow.", "Photograph the trailer VIN, frame, tires, hubs, brakes, lights, coupler, and bunks; report any current inspection or known defect without assuming it is roadworthy for a long tow."],
  ["Photograph the trailer VIN, frame, tires, hubs, lights, coupler, and bunks, and confirm whether it is roadworthy today.", "Photograph the trailer VIN, frame, tires, hubs, brakes, lights, coupler, and bunks; report any current inspection or known defect without assuming roadworthiness."],
  ["when a an individual donation review starts to feel worth considering", "when an individual donation review starts to feel worth considering"],
  ["Yes. Cold water and damp winters leave a lot of Salish Sea boats sitting, and the engine often goes with them. Describe the mechanical problem, how long it has been idle, how it is stored, and the state of the hull and engine. We review each boat individually.", "You may submit it for individual review. Describe the last verified operating date, the known mechanical problem, how long it has been idle, how it is stored, and the present hull and engine condition. Engine status alone does not decide acceptance."],
  ["Gaps are common and workable.", "A gap may or may not be resolvable; the agency holding the record controls that process."],
  ["Estate gaps are common and workable.", "An estate-record gap may or may not be resolvable; the attorney and agency handling the estate and vessel records control that process."],
  ["We will tell you what would be needed.", "Use the issuing agency for a binding answer; the donation review can only identify which facts remain missing."],
  ["we'll explain what would be needed rather than assume.", "use the issuing agency for a binding answer; the donation review can only identify which facts remain missing."],
  ["We will tell you what is workable.", "Use the issuing agency for a binding answer; the donation review cannot cure an ownership gap."],
  ["We will tell you what Texas typically needs.", "Confirm the required correction or replacement process with the Texas agency holding the record."],
  ["We will tell you what usually resolves each gap.", "The agency holding each record determines whether and how a gap may be resolved."],
  ["We will explain what usually resolves each gap.", "The agency holding each record determines whether and how a gap may be resolved."],
  ["We will tell you what a review needs.", "The review can identify which submitted facts remain incomplete; the issuing agency controls any record correction."],
  ["We will tell you what the gaps mean.", "The issuing agency determines what each record gap means and whether it can be corrected."],
  ["We will tell you what usually applies.", "The agency holding each record determines what applies and whether a correction is available."],
  ["We will explain what usually applies.", "The agency holding each record determines what applies and whether a correction is available."],
  ["We will tell you what typically applies to your case.", "The agency holding each record determines what applies and whether a correction is available."],
  ["We will tell you what typically applies to your situation.", "The agency holding each record determines what applies and whether a correction is available."],
  ["we'll point you to what the state needs before ownership can change hands.", "confirm the required ownership evidence with the Nevada agency holding each record before a transfer."],
  ["Every boat gets looked at on its own merits, and a non-running motor by itself is not an automatic no.", "Every boat receives an individual review, and engine status alone does not decide acceptance."],
  ["We look at every boat on its own merits, so a non-running motor is not an automatic no.", "Every boat receives an individual review, and engine status alone does not decide acceptance."],
  ["Usually, yes. Nevada handles the boat and the trailer as separate records, so gather each one along with any lien release. Tell us what you have and what's missing, and confirm the required ownership evidence with the Nevada agency holding each record before a transfer.", "Treat the boat and trailer as separate records. Gather every available title, registration, lien release, and identification number, then confirm the required ownership evidence with the Nevada agency holding each record before a transfer."],
  ["Simply tell us about your boat. We’ll review it, answer your questions, and guide you through the donation process.", "Share your contact information and whatever you know about the boat. We’ll review the request and explain the decision and any authorized next steps."],
  [">See If My Boat Qualifies</a>", ">Request My Individual Review</a>"],
  ["<h2>Recently Donated</h2>", "<h2>Donated Boat Examples</h2>"],
  ["A look at boats owners have recently handed off to us.", "Examples from completed donations previously received by Boats for Charity."],
  ["Donated vessels are listed publicly on eBay under our seller account, so you can see exactly what is available right now — and every sale sends proceeds straight to the charitable programs we support.", "Active donated-vessel listings appear through our eBay seller account. Completed sales help fund the charitable mission; availability and listing details change."],
  ["✔ Photos, condition notes, and pricing on every listing", "✔ Available photos, seller disclosures, and listing terms"],
  ["Often, yes. We review powerboats, sailboats, cruisers, yachts, PWCs, trailers, and non-running vessels case by case. When in doubt, send it in or call us.", "You may submit a non-running vessel for individual review. Condition, ownership, location, storage, and access are considered together; engine status alone never guarantees acceptance."],
  ["Call us at <a href=\"tel:+18555573703\">(855) 557‑3703</a> or send your details through the form above and a real person will reach out.", "Call us at <a href=\"tel:+18555573703\">(855) 557‑3703</a> or send the known facts through the form above for an individual review."],
  ["Most owners just need to send basic contact info first. We follow up for boat condition, title status, location, and timing.", "Start with the required contact fields and add any boat details you already know. Condition, ownership, location, storage, access, and owner deadlines support the review."],
  ["Condition, title status, location, and timing are checked.", "Condition, ownership, location, storage, access, and owner deadlines are considered."],
  ["<h1>Boat Donation Help Across All 50 States</h1>", "<h1>Boat Donation Preparation for All 50 States</h1>"],
  ["Find the state page for your boat's location, storage yard, marina, or paperwork. Each page explains local donation considerations, common boating areas, and the next steps for starting a review.", "Find the state page for the boat's current location. Each page identifies region-specific ownership, storage, condition, access, and buyer-pickup facts to prepare before requesting a review."],
  ["Location details help with buyer access, owner-held storage, title review, facility requirements, and timing.", "Location details support buyer-access, owner-custody, ownership-record, facility, and deadline questions."],
  ["Boat donation logistics can change by region. A boat in a coastal slip, inland storage yard, lake marina, river dock, or residential driveway may need different access details before it can be reviewed. State pages keep those questions easier to find and give search engines clear paths to every local donation guide.", "Boat donation preparation changes by region. A boat in a coastal slip, inland storage yard, lake marina, river dock, or residential driveway can present different ownership, condition, facility, and buyer-access questions. State pages organize those facts so an owner can prepare a more specific review request."],
  ["fill out the quick form below", "use the request form below"],
  ["Honest photos and records produce a faster, more useful answer.", "Honest photos and records support a more grounded, useful review."],
  ["a review goes faster when you're upfront about that", "the review is more grounded when you're upfront about that"],
  ["being upfront makes our review faster and more useful to you", "being upfront makes the review more accurate and useful"],
  ["Being candid speeds things up and keeps the process honest on both sides.", "Being candid keeps the review grounded and the process honest on both sides."],
  ["Clear, honest photos move a review along faster than flattering ones.", "Clear, honest photos give the review better evidence than flattering ones."],
  ["That candor is what lets a review move quickly.", "That candor is what lets the review reflect the facts."],
  ["Honest images move a review along faster than a hopeful description.", "Honest images give the review better evidence than a hopeful description."],
  ["the more grounded the details, the faster that conversation moves", "the more grounded the details, the more useful that conversation becomes"],
  ["The clearer the picture, the faster anyone can tell you whether there's a workable path.", "The clearer the evidence, the better the review can assess whether a workable path may exist."],
  ["An honest set of pictures moves things along faster than a polished one.", "An honest set of pictures gives the review better evidence than a polished one."],
  ["Seeing it upfront keeps a review honest and quick.", "Seeing it up front keeps a review grounded and honest."],
  ["A review moves faster when nothing has to be discovered later.", "A review is more grounded when the material facts are disclosed at the start."],
  ["A review moves faster when there are no surprises left for later.", "A review is more grounded when the material facts are disclosed at the start."],
  ["A review is faster and cleaner when nothing waits to be discovered later.", "A review is more grounded when the material facts are disclosed at the start."],
  ["Showing it plainly keeps a review honest and quick.", "Showing it plainly keeps a review grounded and honest."],
  ["Clear pictures of the real condition move things along far faster than a flattering one.", "Clear pictures of the real condition give the review better evidence than a flattering angle."],
  ["Clear pictures move a review faster than any description.", "Clear pictures give the review stronger evidence than a description."],
  ["an honest set of pictures makes the review faster", "an honest set of pictures makes the review more grounded"],
  ["clear pictures make the review go faster", "clear pictures make the review more grounded"],
  ["Clear pictures move a review along faster than any description.", "Clear pictures give the review stronger evidence than a description."],
  ["Sorting that out early is what makes a donation go smoothly.", "Documenting those facts early is what makes the request reviewable."],
  ["When a boat has become more upkeep than pleasure, donating is one way to hand her off responsibly.", "When a boat has become more upkeep than pleasure, an individual donation review is one option to explore."],
  ["When yours has stopped going in the water, donating it is a practical path.", "When yours has stopped going in the water, an individual donation review is one path to explore."],
  ["An in-slip berth along the Intracoastal Waterway or a rack at a mainland yard carries real monthly cost, and for the larger vessels and yachts that are common on this stretch of the coast, dockage, insurance, and haul-outs for bottom paint add up quickly whether or not the boat ever leaves the dock. If the numbers no longer make sense, a charitable transfer is one way out that keeps the boat out of a fire sale.", "An in-slip berth along the Intracoastal Waterway or a rack at a mainland yard carries real monthly cost, and for the larger vessels and yachts common on this stretch of the coast, dockage, insurance, and bottom maintenance continue whether or not the boat leaves the dock. If the numbers no longer make sense, compare a private sale with an individual donation review without assuming acceptance, timing, or proceeds."],
  ["The most useful thing you can do before donating is write down and photograph how it sits today.", "The most useful thing you can do before requesting a review is write down and photograph how it sits today."],
  ["We received your donation information and will contact you shortly.", "We received your boat information. It will be reviewed, and submission does not mean the boat has been accepted."],
  ["which makes donating a sensible next step", "which can make an individual donation review worth considering"],
  ["donating one is simpler once you know what a review actually needs", "requesting an individual donation review starts with knowing what facts the review needs"],
  ["donating it starts to look like the easier season", "an individual donation review starts to look worth considering"],
  ["donating one is often simpler than it looks", "an individual donation review may be worth considering"],
  ["donating it can be simpler than another season of storage and upkeep", "an individual donation review is one option to compare with another season of storage and upkeep"],
  ["donating it can close the loop", "an individual donation review is one option"],
  ["Donating can take a rarely used boat off your hands before the next season", "An individual donation review can assess the boat, but it does not promise acceptance or completion before another season"],
  ["donating lets someone else make use of it", "an accepted boat may eventually reach a new owner"],
  ["On the Alabama Gulf Coast the hardest part of donating is often just getting the boat off the lift or out of the canal and onto a trailer, so that is where we like to start.", "On the Alabama Gulf Coast, storage and access need to be documented precisely. State whether the boat is on a lift, in a canal, or on a trailer and identify what a future buyer would need to evaluate after a sale."],
  ["how we'd actually get to her", "how a future buyer could lawfully access the boat"],
  ["whether we can actually get to her", "whether a future buyer could lawfully access the boat"],
  ["whether we can practically get to her", "whether a future buyer could lawfully access the boat"],
  ["how a buyer would obtain keys or access and access", "how a buyer would obtain keys and lawful access"],
  ["A boat on a mooring in Plymouth Harbor and the same boat blocked up in a storage yard are two very different pickups, and the access shots are what tell us which one we are dealing with.", "A boat on a mooring in Plymouth Harbor and the same boat blocked in a storage yard present different buyer-access questions. Photograph the mooring or blocking and the complete lawful route to the vessel."],
  ["toward a smooth donation", "toward a well-supported individual review"],
  ["where a clean donation starts", "where an accurate donation review starts"],
  ["against a straightforward donation", "against requesting an individual donation review"],
  ["requesting an individual donation review is one optione along", "requesting an individual donation review is one option to consider"],
  ["donating it may be simpler than you think", "an individual donation review may be worth considering"],
  ["donation starts to make sense", "an individual donation review starts to feel worth considering"],
  ["plenty of boats end up donated once the offshore runs slow down and the winter bills keep coming", "many owners consider a donation review when offshore use slows and winter bills continue"],
  ["a donation starts with a practical question: how does anyone actually get the boat out?", "a review starts with a practical question: what access could a future buyer lawfully use after a sale?"],
  ["want to hand a boat off to charity without the guesswork", "want clear facts before requesting a charity review"],
  ["paperwork that actually moves the transfer along", "paperwork an authorized transfer would require"],
  ["requesting an individual donation review is one option alongside dragging it out again come spring", "requesting an individual donation review is one option to compare with preparing the boat for another spring"],
  ["requesting an individual donation review is one option to move it along", "an individual donation review is one option to consider"],
  ["requesting an individual donation review is one option to close that chapter", "you can compare an individual donation review with a private sale"],
  ["You can request a free human-reviewed estimated market range using the valuation form on this page, and our team emails the range within one to two business days.", "You can request a free human-reviewed estimated market range using the valuation form on this page. The estimate is nonbinding and is not an appraisal, promised sale price, tax value, or donation decision."],
  ["<h2>Your Boat Valuation Is Being Prepared</h2>", "<h2>Valuation Request Received</h2>"],
  ["<p>Please allow 1–2 business days to receive your valuation report.</p>", "<p>Timing depends on the completeness of the information and whether follow-up details are needed.</p>"],
  ["A valuation is prepared by a person, not an automated pricing engine. Nothing on this page is an offer to buy your boat.", "A valuation is prepared by a person, not an automated pricing engine. It is a nonbinding estimate, not an appraisal, promised sale price, tax value, donation decision, or offer to buy the boat."],
  [">See If Your Boat Qualifies</a>", ">Request an Individual Review</a>"],
  [">Start My Free Boat Donation</a>", ">Request a Donation Review</a>"],
  ["the fastest way to find notes for where your boat lives", "the most direct way to find notes for where your boat is kept"],
  ["Larger vessels are sometimes documented federally rather than titled by a state. The Coast Guard's <a href=\"https://cgmix.uscg.mil/PSIX/PSIXSearch.aspx\" rel=\"nofollow noopener\" target=\"_blank\">Port State Information Exchange vessel search</a> and the National Vessel Documentation Center handle federal documentation records. Most recreational boats are <strong>not</strong> federally documented, so a documentation search will not find them.", "Some vessels are documented federally rather than titled by a state. The Coast Guard's <a href=\"https://cgmix.uscg.mil/PSIX/PSIXSearch.aspx\" rel=\"nofollow noopener\" target=\"_blank\">Port State Information Exchange vessel search</a> covers federally documented vessels; a state-titled or state-registered boat may not appear there."],
  ["The majority of recreational boats are titled or registered by a state agency, and that agency holds the ownership record. Start from the official directory of <a href=\"https://www.usa.gov/state-motor-vehicle-services\" rel=\"nofollow noopener\" target=\"_blank\">state motor vehicle and titling services</a> and ask about the vessel record process in that state.", "State-titled or state-registered boats are handled by the applicable state agency, although the responsible office and public-record rules vary. Use the official <a href=\"https://www.usa.gov/state-motor-vehicle-services\" rel=\"nofollow noopener\" target=\"_blank\">state motor vehicle and titling directory</a> as a starting point, then confirm the boat-record office for that state."],
  ["https://www.law.cornell.edu/cfr/text/33/181.25", "https://www.ecfr.gov/current/title-33/chapter-I/subchapter-S/part-181/subpart-C/section-181.25"],
  ["No. A HIN encodes builder and build-date information only. Ownership lives in state title and registration records or, for federally documented vessels, with the U.S. Coast Guard. Those records are not public in the way vehicle records sometimes are, and Boats for Charity cannot look up an owner for you.", "No. A HIN encodes builder and build-date information, not the owner's identity. State access rules vary; for federally documented vessels, Coast Guard PSIX can return public vessel information and the NVDC handles ownership-record requests. Boats for Charity does not provide an owner lookup."],
  ["No, not from the HIN alone. There is no public national registry that maps a HIN to a current owner, and the HIN itself encodes nothing about ownership. Ownership sits in the title or registration file of the state where the boat is registered, or in Coast Guard documentation records for the minority of vessels that are federally documented. Access to those files is restricted, and Boats for Charity cannot identify the current owner of a vessel for you — we do not operate an ownership lookup and we do not publish personal information. If you need an owner identified for a legal reason — an abandoned boat, an estate, a suspected theft — the right route is the state boating agency, the titling agency, or law enforcement.", "No, not from the HIN alone. There is no single public national owner registry covering every recreational boat, and the HIN itself encodes no ownership identity. For a state-titled or state-registered boat, ask the responsible state agency what records an eligible requester may obtain. For a federally documented vessel, Coast Guard PSIX can be searched by HIN for public vessel information, while the National Vessel Documentation Center handles ownership-record products. Boats for Charity does not provide an owner lookup. For an abandoned boat, estate, or suspected theft, use the applicable agency or law-enforcement process."],
  ["Yes, but only through your state, never by you. States issue an assigned or replacement identification number, usually after an inspection that verifies the hull, and that assigned number then functions as the boat's HIN on the title and registration. Contact your state boating or titling agency for their process. Do not stamp or affix a number to a hull yourself.", "An assigned or replacement number may be available through the issuing authority, often after it verifies the hull. The process varies, so contact the applicable state boating or titling agency. Do not alter, stamp, or affix a number yourself."],
  ["States handle this with an assigned or replacement identification number, usually after an inspection that verifies the hull, and that assigned number then functions as the boat's HIN on the title and registration. Ask your state boating agency about their inspection and assignment process. Never stamp a number onto a hull yourself.", "The issuing authority may provide an assigned or replacement identification number after following its verification process. Ask the applicable state boating or titling agency what evidence and inspection it requires. Never alter or stamp a number onto the hull yourself."],
  ["Destin runs on offshore fishing, and its boats work hard in Gulf salt water.", "Offshore fishing defines the local fleet, and these boats work hard in Gulf salt water."],
  ["Access photos should show the gate, road, ramp, dock, lift, trailer, blocking, and any obstacles.", "Photograph the gate, road, ramp, dock, lift, trailer, blocking, and any obstacles."],
  ["Access is often the part people forget, and it's the part that makes or breaks a move.", "Site access is often overlooked, but it can determine what a future buyer can lawfully arrange."],
  ["Lake Tahoe is unlike almost anywhere else a boat can live: deep, cold, crystal-clear freshwater ringed by mountains, a short season, heavy snow, and strict rules meant to keep invasive species out.", "This setting is unlike almost anywhere else a boat can live: deep, cold, crystal-clear freshwater ringed by mountains, a short season, heavy snow, and strict rules meant to keep invasive species out."],
  ["Trailer boats are usually the simplest. Photograph the VIN plate, frame, tires, hubs, lights, coupler, and bunks, confirm its paperwork, and show the full route to the road.", "This is usually the simplest storage setup. Photograph the trailer VIN plate, frame, tires, hubs, lights, coupler, and bunks, confirm its paperwork, and show the full route to the road."],
  ["Access matters as much as condition, because a boat nobody can reach is a boat nobody can move.", "This matters as much as condition because a future buyer needs a lawful, workable path to the vessel."],
  ["Harbor and dock rules, the slip location, depth and access at the ramp or lift, how a buyer would obtain keys and lawful access, and whether she can still move under her own power.", "Document dock rules, the slip location, depth and access at the ramp or lift, how a buyer would obtain keys and lawful access, and whether the boat can still move under its own power."],
  ["Lake Tahoe is unlike almost anywhere else a boat can live: deep, cold, crystal-clear freshwater ringed by mountains, with a season that opens late and closes early because of elevation and weather.", "This setting is unlike almost anywhere else a boat can live: deep, cold, crystal-clear freshwater ringed by mountains, with a season that opens late and closes early because of elevation and weather."],
  ["Trailer boats are usually the simplest. Photograph the VIN plate, frame, tires, hubs, lights, coupler, and bunks, confirm the trailer's own registration, and describe the route out of wherever it's parked.", "This is usually the simplest storage setup. Photograph the trailer VIN plate, frame, tires, hubs, lights, coupler, and bunks, confirm its registration, and describe the route to the public road."],
  ["Harbor and dock rules, the slip location, depth and access at the ramp or lift, how a buyer would obtain keys or access, and whether she moves under her own power.", "Document dock rules, the slip location, depth and access at the ramp or lift, how a buyer would obtain keys and lawful access, and whether the boat can still move under its own power."],
  ["✅ Submission received — we’ll reach out shortly.", "✅ Submission received — review is separate from acceptance."],
  ["✅ Submission received — we'll reach out shortly.", "✅ Submission received — review is separate from acceptance."],
  ["Making the process simple is my priority.", "Understanding my options is my priority."],
  ["When a boat has become more chore than joy, donating it is an easy way to pass it along.", "When a boat has become more chore than joy, an individual donation review is one option to consider."],
  ["That is usually the point where donating starts to look better than another year of bills.", "That is a point when owners often compare a private sale with an individual donation review."],
  ["If that is roughly where you are, the good news is the process is simpler than the paperwork makes it look.", "If that is roughly where you are, begin by documenting the ownership, condition, storage, and access facts the review needs."],
  ["being upfront makes the review quicker and more useful for you", "being up front makes the review more grounded and useful"],
  ["a candid set of photos makes the review quicker and the conversation easier", "a candid set of photos gives the review stronger evidence and makes the conversation more grounded"],
  ["Access is usually what makes a move simple or complicated.", "That access determines what a future buyer can lawfully arrange after a sale."],
  ["Access is usually what makes a move simple or slow.", "That access determines what a future buyer can lawfully arrange after a sale."],
  ["Access is usually what makes a move easy or hard.", "That access determines what a future buyer can lawfully arrange after a sale."],
  ["This is the simplest case: document it and go.", "This case has fewer unknowns: document it fully and submit it for individual review."],
  ["Possibly. A personal watercraft that won't start is common and not an automatic no, but condition and honesty matter.", "You may submit it for individual review. A personal watercraft that will not start is not an automatic decline, but condition and complete disclosure matter."],
  ["Listings change as boats are donated and sold, so the eBay page is always the most current view of our inventory.", "Listings change as boats are donated and sold, so check the linked eBay account for active inventory."],
  ["Many boats here travel best on their own trailer.", "If a trailer is included, its paperwork and roadworthiness need separate review."],
  ["Coeur d Alene", "Coeur d'Alene"],
  ["Kailua Kona", "Kailua-Kona"],
  ["St Petersburg", "St. Petersburg"],
  ["St Louis", "St. Louis"],
  ["A boat with a road-ready trailer parked with clear turning room is one thing; a boat behind a locked gate on soft ground with dry-rotted tires is another.", "A boat on a trailer with current records, recent road use, and clear turning room presents different facts from one behind a locked gate on soft ground with dry-rotted tires."],
  ["Photograph the trailer VIN plate, frame, tires, hubs, lights, and coupler, and check whether it is roadworthy.", "Photograph the trailer VIN plate, frame, tires, hubs, lights, and coupler; report its last road use, tire age, known defects, and any professional inspection."],
  ["Photograph the trailer VIN, frame, tires, hubs, lights, coupler, and bunks, and be honest about whether it could safely tow today.", "Photograph the trailer VIN, frame, tires, hubs, lights, coupler, and bunks; report its last road use, tire age, known defects, and any professional inspection."],
  ["Photograph the trailer VIN, frame, tires, hubs, lights, coupler, and bunks, and say whether it is safe to tow as it stands.", "Photograph the trailer VIN, frame, tires, hubs, lights, coupler, and bunks; report its last road use, tire age, known defects, and any professional inspection."],
  ["Photograph the trailer VIN, frame, tires, hubs, lights, coupler, and bunks, and say whether it is safe to tow today.", "Photograph the trailer VIN, frame, tires, hubs, lights, coupler, and bunks; report its last road use, tire age, known defects, and any professional inspection."],
  ["Because these boats live on trailers, two things carry weight in a review: the shape the hull is in after years of freshwater use, and whether the trailer under it can safely roll.", "Because these boats live on trailers, two subjects carry weight in a review: the hull's current freshwater condition and the trailer's records, last road use, visible condition, and access to the public road."],
  ["Photograph the trailer VIN, frame, tires, hubs, lights, and coupler, and be honest about whether it can safely roll down the road.", "Photograph the trailer VIN, frame, tires, hubs, lights, and coupler; report its last road use, tire age, known defects, and any professional inspection."],
  ["Marina access and roadworthy trailers are practical review points.", "Marina access, trailer condition, and the route to the public road are practical review points."],
  ["trailer roadworthiness,", "documented trailer condition,"],
  ["the trailer's roadworthiness,", "the trailer's documented condition,"],
  ["whether the trailer is truly roadworthy,", "the trailer's last road use and documented condition,"],
  ["whether the trailer is roadworthy,", "the trailer's last road use and documented condition,"],
  ["trailer roadworthiness comes first", "trailer records, last road use, and visible condition come first"],
  ["Trailer roadworthiness matters most here", "Trailer records, last road use, and visible condition matter most here"],
  ["If a trailer is included, its paperwork and roadworthiness need separate review.", "If a trailer is included, its paperwork, visible condition, known defects, and any current inspection need separate review."],
  ["A roadworthy trailer changes the options considerably, so note its registration and condition honestly.", "A trailer with current records and a recent professional inspection may expand a buyer's options; report the registration, last road use, visible condition, and known defects."],
  ["A roadworthy trailer changes the picture, so show us the route from where it sits out to the street.", "Report the trailer's last road use, visible condition, and known defects, and show the route from where it sits out to the street."],
  ["A roadworthy trailer changes what is possible.", "A buyer evaluates the trailer's records, condition, and any current inspection after a sale."],
  ["A trailer that has sat in salt air may not be roadworthy, so note tire age and rust.", "A trailer that has sat in salt air may have hidden defects, so note tire age, corrosion, known problems, and any professional inspection."],
  ["after a few winters donation starts to make more sense than another season of upkeep.", "after a few winters, owners may compare a private sale, another season of upkeep, and an individual donation review."],
  ["there comes a point where donating makes more sense than another year of storage.", "owners may compare another year of storage with a private sale or an individual donation review."],
  ["at some point donating starts to make more sense than another haul-out.", "owners may compare another haul-out with a private sale or an individual donation review."],
  ["A short boating season and a long, hard winter push a lot of Milwaukee owners to donate rather than pay to store a boat they no longer use.", "A short boating season and a long, hard winter lead many Milwaukee owners to compare storage, a private sale, and an individual donation review."],
  ["This is serious offshore fishing country, and the boats that run it hard eventually reach a point where a donation makes more sense than another repower.", "This is serious offshore fishing country, and owners of hard-run boats eventually have to compare another repower, a private sale, and an individual donation review."],
  ["When a repower or a full refit stops making financial sense, owners often look at donating rather than sinking more into a boat they no longer take out.", "When a repower or full refit stops making financial sense, owners often compare that cost with a private sale and an individual donation review."],
  ["Boats like these often outlast their owners' ability to use them, and when the next haul-out or refit is more than makes sense, donating feels like the right ending for a boat with some history.", "Boats like these often outlast their owners' ability to use them. When the next haul-out or refit no longer makes sense, owners may compare a private sale with an individual donation review while keeping the boat secure."],
  ["their owners start wondering whether donating makes more sense than another spring of yard bills.", "their owners start comparing another spring of yard bills with a private sale and an individual donation review."],
  ["so a dead motor doesn't rule out a request.", "and engine status alone does not decide acceptance."],
  ["and a dead motor alone does not rule it out.", "and engine status alone does not decide acceptance."],
  ["so a dead motor does not rule it out.", "and engine status alone does not decide acceptance."],
  ["so a bad season in the heat does not rule it out.", "so heat exposure alone does not decide acceptance."],
  ["A dead motor or a soft transom does not rule a boat out.", "Engine status or a soft transom alone does not decide acceptance."],
  ["None of that is unusual, and none of it disqualifies a boat.", "Those conditions are not unusual, and none of those facts decides acceptance by itself."],
  ["It does not rule a boat out, but it shapes the whole picture.", "Storm history alone does not decide acceptance, but it belongs in the full review."],
  ["A personal watercraft that will not start is not an automatic decline, but condition and complete disclosure matter.", "Engine status alone does not decide acceptance; condition and complete disclosure still matter."],
  ["None of that rules a boat out, but it helps us route it correctly.", "No single condition fact decides acceptance; report each one so the individual review can consider the whole boat."],
  ["Freeze-cracked blocks, water that got in and froze, soft spots in the deck, and corroded fittings are all common up here, and none of them are disqualifying by themselves.", "Freeze-cracked blocks, frozen-water damage, soft deck areas, and corroded fittings are relevant condition facts; no single one decides acceptance by itself."],
  ["Every boat gets looked at on its own merits, and a non-running motor doesn't disqualify anything on its own.", "Every boat is reviewed on its complete facts; engine status alone does not decide acceptance."],
  ["A dead outboard or a seized inboard doesn't disqualify a boat here.", "A dead outboard or seized inboard is one condition fact; it does not decide acceptance by itself."],
  ["Every boat is looked at on its own, and a non-running vessel is not disqualified up front.", "Every boat is reviewed on its complete facts; a non-running vessel may be submitted, but acceptance is not decided in advance."],
  ["Does storm or hurricane damage rule a boat out?", "Can I submit a boat with storm or hurricane damage?"],
  ["Not automatically. Storm-surge flooding, wind damage, and time on the hard after a hurricane are common on the Gulf Coast, so describe what happened and share photos. The boat is still reviewed on its own condition.", "You may submit it for individual review. Describe any storm-surge flooding, wind damage, and time on the hard after a hurricane, and share current photos. Acceptance depends on the complete condition, ownership, storage, and access facts."],
  ["Freshwater is gentler on metal than salt, but none of this rules a boat out.", "Freshwater is gentler on metal than salt, but every condition fact still belongs in the review; no single observation decides acceptance."],
  ["None of that rules a boat out.", "No single condition fact decides acceptance; disclose each one so the review reflects the complete boat."],
  ["None of it rules a boat out; it just helps us route it accurately.", "No single condition fact decides acceptance; accurate disclosure helps the individual review assess the complete boat."],
  ["It does not disqualify a boat, but it changes the picture, and we would rather know up front.", "It is one condition fact in the complete review, and reporting it up front avoids an unsupported assumption."],
  ["None of it rules a boat out; it just helps us route it correctly.", "No single condition fact decides acceptance; report each one so the individual review can assess the complete boat."],
  ["Do freeze cracks or a bad winter rule a boat out?", "How should I document freeze cracks or winter damage?"],
  ["Not on their own. Freeze damage is worth disclosing plainly — a cracked block, split manifold, or water in the bilge from a rough winter all matter — but every boat is reviewed individually, and honest detail about the damage helps more than leaving it out.", "Describe freeze damage plainly: a cracked block, split manifold, or water in the bilge from a rough winter all matter. Every boat receives an individual review, and no acceptance decision is made from one fact alone."],
  ["Blistered gelcoat, a cracked block, bottom growth from a season on a mooring, corroded fittings from years of Atlantic salt air: none of that is disqualifying, but we need to know about it.", "Report blistered gelcoat, a cracked block, bottom growth from a season on a mooring, and corroded fittings from years of Atlantic salt air. Each is relevant to the complete review, and none decides acceptance by itself."],
  ["None of that is disqualifying; it just helps us route the boat.", "No single condition fact decides acceptance; complete disclosure helps the individual review assess the boat."],
];

function read(relative) {
  return fs.readFileSync(path.join(ROOT, relative), "utf8");
}

function write(relative, value) {
  fs.writeFileSync(path.join(ROOT, relative), value);
}

function replaceOnce(relative, html, before, after) {
  const occurrences = html.split(before).length - 1;
  if (!occurrences) {
    if (html.includes(after)) return html;
    const knownMigration = siteWideReplacements.some(([older, newer]) =>
      (newer === after && html.includes(older)) || (older === after && html.includes(newer)),
    );
    if (knownMigration) return html;
    throw new Error(`${relative}: reviewed editorial source text was not found: ${before.slice(0, 100)}`);
  }
  return html.split(before).join(after);
}

// Repair an interrupted earlier run before the strict idempotent replacements below.
{
  const relative = "city/lake-ozark/index.html";
  let html = read(relative);
  html = html.split('Do not turn an unverified guess such as "just needs a battery" into a condition claim.').join("Do not turn an unverified guess such as &quot;just needs a battery&quot; into a condition claim.");
  write(relative, html);
}
{
  const relative = "guides/how-to-donate-a-boat/index.html";
  let html = read(relative);
  html = html.split("If you receive written acceptance, follow the authorized transfer instructions, sign the ownership over cleanly, and keep the paperwork you will need at tax time.").join("If you receive written acceptance, follow the authorized transfer instructions for that boat and keep the completed ownership and tax records.");
  html = html.split("It is more accurate to think of it as a transfer of titled personal property to a charitable organization.").join("It is more accurate to think of it as a legally documented charitable gift involving titled personal property.");
  write(relative, html);
}
{
  const relative = "guides/boat-donation-paperwork/index.html";
  let html = read(relative);
  html = html.split("If the request is accepted, this is the file created during the authorized handoff and retained afterward.").join("If the request is accepted, this is the file created during the authorized transfer and retained afterward.");
  write(relative, html);
}

for (const [relative, values] of Object.entries(metadata)) {
  let html = read(relative);
  if (values.title) html = html.replace(/<title>[^<]*<\/title>/i, `<title>${values.title}</title>`);
  if (values.description) {
    html = html.replace(/<meta\s+name=["']description["'][^>]*>/i, `<meta name="description" content="${values.description}">`);
  }
  write(relative, html);
}

for (const [relative, changes] of Object.entries(replacements)) {
  let html = read(relative);
  for (const [before, after] of changes) html = replaceOnce(relative, html, before, after);
  write(relative, html);
}

// The same generic five-question checklist and evidence reminder had been
// repeated across nearly every guide. Each guide already addresses its own
// relevant facts in context, while the complete reusable checklist lives in
// the step-by-step, paperwork, and transparency guides. Remove the duplicate
// footer block so readers do not encounter the same material page after page.
{
  const repeatedGuideBlock = '<h2>Questions to resolve before transfer</h2><ul><li>Who is legally authorized to transfer the boat and trailer?</li><li>Which title, registration, lien, estate, or documentation records exist?</li><li>What is the current hull, engine, equipment, and trailer condition?</li><li>Where is the vessel stored, and what access, fee, or deadline applies?</li><li>Which acceptance, buyer-access, timing, value, and tax assumptions remain unconfirmed?</li></ul><h2>Keep the review grounded in evidence</h2><p>Use current photographs, exact identification numbers, direct facility information, and relevant records. Do not cancel storage, insurance, or security arrangements until ownership has transferred and required notices are complete. We review every boat individually.</p>';
  const wrappedGuideBlock = `<section class="section alt"><div class="wrap">${repeatedGuideBlock}</div></section>`;
  for (const absolute of listHtml(path.join(ROOT, "guides"))) {
    let html = fs.readFileSync(absolute, "utf8");
    html = html.split(wrappedGuideBlock).join("");
    html = html.split(repeatedGuideBlock).join("");
    fs.writeFileSync(absolute, html);
  }
}

// Remove an exact duplicate answer that appeared twice in the HIN FAQ.
{
  const relative = "hin-lookup.html";
  let html = read(relative);
  const answer = "    <p>No. A HIN encodes builder and build-date information only. Ownership lives in state title and registration records or, for federally documented vessels, with the U.S. Coast Guard. Those records are not public in the way vehicle records sometimes are, and Boats for Charity cannot look up an owner for you.</p>";
  html = html.replace(`${answer}\n${answer}`, answer);
  write(relative, html);
}

function listHtml(directory) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if ([".git", "node_modules", "artifacts"].includes(entry.name)) continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...listHtml(absolute));
    else if (entry.isFile() && entry.name.endsWith(".html")) files.push(absolute);
  }
  return files;
}

for (const absolute of listHtml(ROOT)) {
  let html = fs.readFileSync(absolute, "utf8");
  for (const [before, after] of siteWideReplacements) html = html.split(before).join(after);
  const relative = path.relative(ROOT, absolute).split(path.sep).join("/");
  if (/^city\/[^/]+\/index\.html$/.test(relative)) {
    html = html.replace(
      /(<h3\b[^>]*>[^<]*\bCan I\s+(?:still\s+)?(?:donate|submit)\b[^<]*<\/h3>\s*<p\b[^>]*>)[^.!?<]*[.!?]\s*/gi,
      "$1You may submit it for individual review. ",
    );
    const donationSubject = "(?:donating(?: it| one| the boat)?|(?:a )?(?:charitable )?donation|a charitable transfer)";
    const comparativeClaim = new RegExp(`\\b${donationSubject}\\s+(?:can|may|is|becomes)?\\s*(?:often\\s+)?(?:be\\s+)?(?:a|the)\\s+(?:cleaner|simpler|easier)\\s+(?:way|path|exit|ending|move|option)\\s+than\\b`, "gi");
    const qualityClaim = new RegExp(`\\b${donationSubject}\\s+(?:can|may|is|becomes|starts to look like)?\\s*(?:often\\s+)?(?:be\\s+)?(?:a|the)\\s+(?:cleanest|cleaner|clean|straightforward|sensible|practical|responsible|simplest|easier|honest|better|reasonable|tidy)\\s+(?:way|path|exit|ending|move|step|option|outcome)(?:\\s+(?:out|forward|to move one along|to move on|to hand it off|to close that out|to stop that cycle))?`, "gi");
    const oneWayClaim = /\bDonating(?: it| one| the boat)?\s+is\s+(?:(?:one|a)\s+)?(?:clean\s+|honest\s+)?way\s+(?:out|forward|through that|to\s+[^,.]{1,55})/gi;
    const replacement = (match, suffix = "") => `${/^[A-Z]/.test(match) ? "Requesting" : "requesting"} an individual donation review is one option${suffix}`;
    html = html.replace(comparativeClaim, (match) => replacement(match, " alongside"));
    html = html.replace(qualityClaim, (match) => replacement(match));
    html = html.replace(oneWayClaim, (match) => replacement(match));
  }
  fs.writeFileSync(absolute, html);
}

console.log(`Applied reviewed metadata to ${Object.keys(metadata).length} pages and editorial refinements to ${Object.keys(replacements).length} page sets.`);
