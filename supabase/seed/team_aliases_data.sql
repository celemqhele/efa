-- Team aliases seed data
-- Run AFTER 044_team_aliases.sql and 045_teams_search_vector.sql migrations

INSERT INTO team_aliases (team_id, alias) VALUES
  -- AC Milan
  ((SELECT id FROM teams WHERE name = 'AC Milan'), 'milan'),
  ((SELECT id FROM teams WHERE name = 'AC Milan'), 'acm'),
  
  -- Ajax
  ((SELECT id FROM teams WHERE name = 'Ajax'), 'aja'),
  
  -- Al Ettifaq
  ((SELECT id FROM teams WHERE name = 'Al Ettifaq'), 'ett'),
  
  -- Al Hilal
  ((SELECT id FROM teams WHERE name = 'Al Hilal'), 'hil'),
  
  -- Al Khaleej
  ((SELECT id FROM teams WHERE name = 'Al Khaleej'), 'kha'),
  
  -- Al Nassr
  ((SELECT id FROM teams WHERE name = 'Al Nassr'), 'nas'),
  
  -- Algeria National Team
  ((SELECT id FROM teams WHERE name = 'Algeria National Team'), 'alg'),
  
  -- Argentina National Team
  ((SELECT id FROM teams WHERE name = 'Argentina National Team'), 'arg'),
  
  -- Arsenal
  ((SELECT id FROM teams WHERE name = 'Arsenal'), 'ars'),
  ((SELECT id FROM teams WHERE name = 'Arsenal'), 'afc'),
  
  -- Aston Villa
  ((SELECT id FROM teams WHERE name = 'Aston Villa'), 'avl'),
  ((SELECT id FROM teams WHERE name = 'Aston Villa'), 'villa'),
  
  -- Atlas Lions
  ((SELECT id FROM teams WHERE name = 'Atlas Lions'), 'atl'),
  
  -- Atletico Madrid
  ((SELECT id FROM teams WHERE name = 'Atletico Madrid'), 'atm'),
  ((SELECT id FROM teams WHERE name = 'Atletico Madrid'), 'atleti'),
  
  -- Barcelona
  ((SELECT id FROM teams WHERE name = 'Barcelona'), 'bar'),
  ((SELECT id FROM teams WHERE name = 'Barcelona'), 'fcb'),
  
  -- Bayer Leverkusen
  ((SELECT id FROM teams WHERE name = 'Bayer Leverkusen'), 'b04'),
  ((SELECT id FROM teams WHERE name = 'Bayer Leverkusen'), 'lev'),
  
  -- Bayern Munich
  ((SELECT id FROM teams WHERE name = 'Bayern Munich'), 'bay'),
  ((SELECT id FROM teams WHERE name = 'Bayern Munich'), 'bayern'),
  ((SELECT id FROM teams WHERE name = 'Bayern Munich'), 'fcb'),
  
  -- Belgium National Team
  ((SELECT id FROM teams WHERE name = 'Belgium National Team'), 'bel'),
  
  -- Borussia Dortmund
  ((SELECT id FROM teams WHERE name = 'Borussia Dortmund'), 'bvb'),
  ((SELECT id FROM teams WHERE name = 'Borussia Dortmund'), 'dor'),
  
  -- Bournemouth
  ((SELECT id FROM teams WHERE name = 'Bournemouth'), 'bou'),
  
  -- Brazil National Team
  ((SELECT id FROM teams WHERE name = 'Brazil National Team'), 'bra'),
  
  -- Brentford
  ((SELECT id FROM teams WHERE name = 'Brentford'), 'bre'),
  
  -- Brighton & Hove Albion
  ((SELECT id FROM teams WHERE name = 'Brighton & Hove Albion'), 'bha'),
  ((SELECT id FROM teams WHERE name = 'Brighton & Hove Albion'), 'bri'),
  
  -- Burnley
  ((SELECT id FROM teams WHERE name = 'Burnley'), 'bur'),
  
  -- Chelsea
  ((SELECT id FROM teams WHERE name = 'Chelsea'), 'che'),
  
  -- Club Brugge
  ((SELECT id FROM teams WHERE name = 'Club Brugge'), 'clb'),
  ((SELECT id FROM teams WHERE name = 'Club Brugge'), 'bru'),
  
  -- Cobalt FC
  ((SELECT id FROM teams WHERE name = 'Cobalt FC'), 'cob'),
  
  -- Como 1907
  ((SELECT id FROM teams WHERE name = 'Como 1907'), 'com'),
  
  -- Croatia National Team
  ((SELECT id FROM teams WHERE name = 'Croatia National Team'), 'cro'),
  
  -- Crystal Palace
  ((SELECT id FROM teams WHERE name = 'Crystal Palace'), 'cry'),
  ((SELECT id FROM teams WHERE name = 'Crystal Palace'), 'cpfc'),
  
  -- Dundee United
  ((SELECT id FROM teams WHERE name = 'Dundee United'), 'dun'),
  
  -- Egypt National Team
  ((SELECT id FROM teams WHERE name = 'Egypt National Team'), 'egy'),
  
  -- England National Team
  ((SELECT id FROM teams WHERE name = 'England National Team'), 'eng'),
  
  -- Everton
  ((SELECT id FROM teams WHERE name = 'Everton'), 'eve'),
  
  -- France National Team
  ((SELECT id FROM teams WHERE name = 'France National Team'), 'fra'),
  
  -- Fulham
  ((SELECT id FROM teams WHERE name = 'Fulham'), 'ful'),
  
  -- Germany National Team
  ((SELECT id FROM teams WHERE name = 'Germany National Team'), 'ger'),
  
  -- Ghana National Team
  ((SELECT id FROM teams WHERE name = 'Ghana National Team'), 'gha'),
  
  -- Haiti National Team
  ((SELECT id FROM teams WHERE name = 'Haiti National Team'), 'hai'),
  
  -- Inter Milan
  ((SELECT id FROM teams WHERE name = 'Inter Milan'), 'int'),
  ((SELECT id FROM teams WHERE name = 'Inter Milan'), 'inter'),
  
  -- Ipswich
  ((SELECT id FROM teams WHERE name = 'Ipswich'), 'ips'),
  
  -- Iran National Team
  ((SELECT id FROM teams WHERE name = 'Iran National Team'), 'irn'),
  
  -- Japan National Team
  ((SELECT id FROM teams WHERE name = 'Japan National Team'), 'jpn'),
  
  -- Juventus
  ((SELECT id FROM teams WHERE name = 'Juventus'), 'juv'),
  
  -- Leeds United
  ((SELECT id FROM teams WHERE name = 'Leeds United'), 'lee'),
  
  -- Liverpool
  ((SELECT id FROM teams WHERE name = 'Liverpool'), 'liv'),
  
  -- Manchester City
  ((SELECT id FROM teams WHERE name = 'Manchester City'), 'mci'),
  ((SELECT id FROM teams WHERE name = 'Manchester City'), 'mancity'),
  
  -- Manchester United
  ((SELECT id FROM teams WHERE name = 'Manchester United'), 'mun'),
  ((SELECT id FROM teams WHERE name = 'Manchester United'), 'manu'),
  
  -- Mexico National Team
  ((SELECT id FROM teams WHERE name = 'Mexico National Team'), 'mex'),
  
  -- Morocco National Team
  ((SELECT id FROM teams WHERE name = 'Morocco National Team'), 'mar'),
  ((SELECT id FROM teams WHERE name = 'Morocco National Team'), 'mor'),
  
  -- Nantes
  ((SELECT id FROM teams WHERE name = 'Nantes'), 'nan'),
  ((SELECT id FROM teams WHERE name = 'Nantes'), 'fcn'),
  
  -- Napoli
  ((SELECT id FROM teams WHERE name = 'Napoli'), 'nap'),
  
  -- Netherlands National Team
  ((SELECT id FROM teams WHERE name = 'Netherlands National Team'), 'ned'),
  ((SELECT id FROM teams WHERE name = 'Netherlands National Team'), 'hol'),
  
  -- New Zealand National Team
  ((SELECT id FROM teams WHERE name = 'New Zealand National Team'), 'nzl'),
  
  -- Newcastle United
  ((SELECT id FROM teams WHERE name = 'Newcastle United'), 'new'),
  ((SELECT id FROM teams WHERE name = 'Newcastle United'), 'nufc'),
  
  -- Norway National Team
  ((SELECT id FROM teams WHERE name = 'Norway National Team'), 'nor'),
  
  -- Nottingham Forest
  ((SELECT id FROM teams WHERE name = 'Nottingham Forest'), 'nfo'),
  ((SELECT id FROM teams WHERE name = 'Nottingham Forest'), 'forest'),
  
  -- Palmeiras
  ((SELECT id FROM teams WHERE name = 'Palmeiras'), 'pal'),
  
  -- Paris Saint Germain
  ((SELECT id FROM teams WHERE name = 'Paris Saint Germain'), 'psg'),
  
  -- Portuguese Football Federation
  ((SELECT id FROM teams WHERE name = 'Portuguese Football Federation'), 'por'),
  
  -- Real Betis
  ((SELECT id FROM teams WHERE name = 'Real Betis'), 'bet'),
  
  -- Real Madrid
  ((SELECT id FROM teams WHERE name = 'Real Madrid'), 'rma'),
  ((SELECT id FROM teams WHERE name = 'Real Madrid'), 'madrid'),
  
  -- Santos
  ((SELECT id FROM teams WHERE name = 'Santos'), 'san'),
  
  -- Saudi Arabia National Team
  ((SELECT id FROM teams WHERE name = 'Saudi Arabia National Team'), 'ksa'),
  ((SELECT id FROM teams WHERE name = 'Saudi Arabia National Team'), 'sau'),
  ((SELECT id FROM teams WHERE name = 'Saudi Arabia National Team'), 'sa'),
  
  -- South Africa National Team
  ((SELECT id FROM teams WHERE name = 'South Africa National Team'), 'rsa'),
  ((SELECT id FROM teams WHERE name = 'South Africa National Team'), 'sa'),
  
  -- South Korea National Team
  ((SELECT id FROM teams WHERE name = 'South Korea National Team'), 'kor'),
  
  -- Spain National Team
  ((SELECT id FROM teams WHERE name = 'Spain National Team'), 'esp'),
  
  -- Sporting CP
  ((SELECT id FROM teams WHERE name = 'Sporting CP'), 'scp'),
  ((SELECT id FROM teams WHERE name = 'Sporting CP'), 'sporting'),
  
  -- Sunderland
  ((SELECT id FROM teams WHERE name = 'Sunderland'), 'sun'),
  
  -- Switzerland National Team
  ((SELECT id FROM teams WHERE name = 'Switzerland National Team'), 'sui'),
  
  -- Tottenham Hotspur
  ((SELECT id FROM teams WHERE name = 'Tottenham Hotspur'), 'tot'),
  ((SELECT id FROM teams WHERE name = 'Tottenham Hotspur'), 'spurs'),
  
  -- Turkey National Team
  ((SELECT id FROM teams WHERE name = 'Turkey National Team'), 'tur'),
  
  -- Uruguay National Team
  ((SELECT id FROM teams WHERE name = 'Uruguay National Team'), 'uru'),
  
  -- USA National Team
  ((SELECT id FROM teams WHERE name = 'USA National Team'), 'usa'),
  
  -- Uzbekistan National Team
  ((SELECT id FROM teams WHERE name = 'Uzbekistan National Team'), 'uzb'),
  
  -- West Ham United
  ((SELECT id FROM teams WHERE name = 'West Ham United'), 'whu'),
  ((SELECT id FROM teams WHERE name = 'West Ham United'), 'hammers'),
  
  -- Wolves
  ((SELECT id FROM teams WHERE name = 'Wolves'), 'wol'),
  ((SELECT id FROM teams WHERE name = 'Wolves'), 'wlv')
ON CONFLICT (team_id, alias) DO NOTHING;