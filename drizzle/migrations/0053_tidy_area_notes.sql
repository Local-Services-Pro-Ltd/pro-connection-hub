-- Three areas went live but still carried their old "Opening …" notes.
-- The public pages already hide those notes for live areas; make the stored
-- data match by describing the area instead, as Kent and Surrey do.
UPDATE public.areas SET note = 'Reading, Slough, Bracknell, Maidenhead and Newbury'
 WHERE slug = 'berkshire' AND status = 'live' AND note LIKE 'Opening%';
UPDATE public.areas SET note = 'Aylesbury, High Wycombe, Amersham and Milton Keynes'
 WHERE slug = 'buckinghamshire' AND status = 'live' AND note LIKE 'Opening%';
UPDATE public.areas SET note = 'Watford, St Albans, Stevenage, Hemel Hempstead and Ware'
 WHERE slug = 'hertfordshire' AND status = 'live' AND note LIKE 'Opening%';

-- Three coming-soon areas promised an opening quarter. An area opens when
-- enough checked firms have joined it, not on a date, so describe the area
-- and let the waiting list carry the "tell me when" promise.
UPDATE public.areas SET note = 'Chelmsford, Colchester, Basildon, Southend and Brentwood'
 WHERE slug = 'essex' AND note LIKE 'Opening%';
UPDATE public.areas SET note = 'Brighton, Crawley, Worthing, Eastbourne and Hastings'
 WHERE slug = 'sussex' AND note LIKE 'Opening%';
UPDATE public.areas SET note = 'Southampton, Portsmouth, Winchester, Basingstoke and Andover'
 WHERE slug = 'hampshire' AND note LIKE 'Opening%';
