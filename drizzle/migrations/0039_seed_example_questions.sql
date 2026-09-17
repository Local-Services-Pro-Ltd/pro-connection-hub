-- Clearly labelled example Q&A so a brand-new board reads as new, not broken.
WITH q AS (
  INSERT INTO public.questions (title, body, asker_name, trade_slug, area, status, published_at)
  VALUES
    ('Boiler pressure keeps dropping to zero — repair or replace?',
     'Our combi boiler is nine years old. Pressure falls from 1.5 bar to zero every four or five days and I top it back up. No visible leaks under the radiators. Is this a small repair or are we looking at a new boiler?',
     'Example question', 'gas-heating-engineer', 'Greater London', 'published', now()),
    ('How much should a full rewire cost on a three-bed terrace?',
     'Nineteen-seventies three-bed terrace, original fuse box, no RCD protection. We want a realistic range before we start getting quotes, and to know what should be included in the price.',
     'Example question', 'electrician', 'Kent', 'published', now()),
    ('Damp patch on the chimney breast after heavy rain — where do I start?',
     'A brown tide mark appears on the upstairs chimney breast within a day of heavy rain, then dries out. Do I need a roofer, a chimney specialist or a damp survey first?',
     'Example question', 'roofer', 'Surrey', 'published', now()),
    ('Do I need building regs for a knocked-through kitchen wall?',
     'We want to open up between kitchen and dining room. Nobody is sure whether the wall is load-bearing. What has to be signed off, and who signs it?',
     'Example question', 'builder', 'Greater London', 'published', now())
  RETURNING id, trade_slug
)
INSERT INTO public.answers (question_id, author_name, body, status, published_at)
SELECT q.id, 'TradesmanFinder (example answer)',
  CASE q.trade_slug
    WHEN 'gas-heating-engineer' THEN 'Losing pressure with no visible leak usually points to one of three things: a failed expansion vessel, a weeping pressure relief valve discharging outside, or a pinhole in buried pipework. A Gas Safe engineer can test the vessel and check the external discharge pipe in under an hour. At nine years old a repair is normally the sensible first step — replacement only makes sense if the heat exchanger is going as well.'
    WHEN 'electrician' THEN 'For a 1970s three-bed terrace, most firms land between roughly £4,000 and £6,500 depending on how much chasing and making good is involved. The quote should spell out the new consumer unit, number of sockets and lights, smoke alarms to current standards, testing, the electrical installation certificate and building control notification. Ask whether plastering and decorating afterwards is included — that is the most common gap between two quotes.'
    WHEN 'roofer' THEN 'Start with the roofer. A mark that appears within a day of rain and dries out is almost always water entering at the stack — cracked flaunching, failed lead flashing where the chimney meets the roof, or missing pointing. A damp survey before the roof has been checked usually just confirms there is water, without telling you where it came in.'
    ELSE 'Anything structural needs building control approval. In practice a structural engineer specifies the beam and produces calculations, your builder installs it, and building control inspects it before and after the work is closed up. You will want that completion certificate — a buyer''s solicitor will ask for it.'
  END,
  'published', now()
FROM q;
