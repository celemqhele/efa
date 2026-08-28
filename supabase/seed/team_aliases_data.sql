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
  
  -- Algeria
  ((SELECT id FROM teams WHERE name = 'Algeria'), 'alg'),
  
  -- Argentina
  ((SELECT id FROM teams WHERE name = 'Argentina'), 'arg'),
  
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
  
  -- Belgium
  ((SELECT id FROM teams WHERE name = 'Belgium'), 'bel'),
  
  -- Borussia Dortmund
  ((SELECT id FROM teams WHERE name = 'Borussia Dortmund'), 'bvb'),
  ((SELECT id FROM teams WHERE name = 'Borussia Dortmund'), 'dor'),
  
  -- Bournemouth
  ((SELECT id FROM teams WHERE name = 'Bournemouth'), 'bou'),
  
  -- Brazil
  ((SELECT id FROM teams WHERE name = 'Brazil'), 'bra'),
  
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
  
  -- Croatia
  ((SELECT id FROM teams WHERE name = 'Croatia'), 'cro'),
  
  -- Crystal Palace
  ((SELECT id FROM teams WHERE name = 'Crystal Palace'), 'cry'),
  ((SELECT id FROM teams WHERE name = 'Crystal Palace'), 'cpfc'),
  
  -- Dundee United
  ((SELECT id FROM teams WHERE name = 'Dundee United'), 'dun'),
  
  -- Egypt
  ((SELECT id FROM teams WHERE name = 'Egypt'), 'egy'),
  
  -- England
  ((SELECT id FROM teams WHERE name = 'England'), 'eng'),
  
  -- Everton
  ((SELECT id FROM teams WHERE name = 'Everton'), 'eve'),
  
  -- France
  ((SELECT id FROM teams WHERE name = 'France'), 'fra'),
  
  -- Fulham
  ((SELECT id FROM teams WHERE name = 'Fulham'), 'ful'),
  
  -- Germany
  ((SELECT id FROM teams WHERE name = 'Germany'), 'ger'),
  
  -- Ghana
  ((SELECT id FROM teams WHERE name = 'Ghana'), 'gha'),
  
  -- Haiti
  ((SELECT id FROM teams WHERE name = 'Haiti'), 'hai'),
  
  -- Inter Milan
  ((SELECT id FROM teams WHERE name = 'Inter Milan'), 'int'),
  ((SELECT id FROM teams WHERE name = 'Inter Milan'), 'inter'),
  
  -- Ipswich
  ((SELECT id FROM teams WHERE name = 'Ipswich'), 'ips'),
  
  -- Iran
  ((SELECT id FROM teams WHERE name = 'Iran'), 'irn'),
  
  -- Japan
  ((SELECT id FROM teams WHERE name = 'Japan'), 'jpn'),
  
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
  
  -- Mexico
  ((SELECT id FROM teams WHERE name = 'Mexico'), 'mex'),
  
  -- Morocco
  ((SELECT id FROM teams WHERE name = 'Morocco'), 'mar'),
  ((SELECT id FROM teams WHERE name = 'Morocco'), 'mor'),
  
  -- Nantes
  ((SELECT id FROM teams WHERE name = 'Nantes'), 'nan'),
  ((SELECT id FROM teams WHERE name = 'Nantes'), 'fcn'),
  
  -- Napoli
  ((SELECT id FROM teams WHERE name = 'Napoli'), 'nap'),
  
  -- Netherlands
  ((SELECT id FROM teams WHERE name = 'Netherlands'), 'ned'),
  ((SELECT id FROM teams WHERE name = 'Netherlands'), 'hol'),
  
  -- New Zealand
  ((SELECT id FROM teams WHERE name = 'New Zealand'), 'nzl'),
  
  -- Newcastle United
  ((SELECT id FROM teams WHERE name = 'Newcastle United'), 'new'),
  ((SELECT id FROM teams WHERE name = 'Newcastle United'), 'nufc'),
  
  -- Norway
  ((SELECT id FROM teams WHERE name = 'Norway'), 'nor'),
  
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
  
  -- Saudi Arabia
  ((SELECT id FROM teams WHERE name = 'Saudi Arabia'), 'ksa'),
  ((SELECT id FROM teams WHERE name = 'Saudi Arabia'), 'sau'),
  ((SELECT id FROM teams WHERE name = 'Saudi Arabia'), 'sa'),
  
  -- South Africa
  ((SELECT id FROM teams WHERE name = 'South Africa'), 'rsa'),
  ((SELECT id FROM teams WHERE name = 'South Africa'), 'sa'),
  
  -- South Korea
  ((SELECT id FROM teams WHERE name = 'South Korea'), 'kor'),
  
  -- Spain
  ((SELECT id FROM teams WHERE name = 'Spain'), 'esp'),
  
  -- Sporting CP
  ((SELECT id FROM teams WHERE name = 'Sporting CP'), 'scp'),
  ((SELECT id FROM teams WHERE name = 'Sporting CP'), 'sporting'),
  
  -- Sunderland
  ((SELECT id FROM teams WHERE name = 'Sunderland'), 'sun'),
  
  -- Switzerland
  ((SELECT id FROM teams WHERE name = 'Switzerland'), 'sui'),
  
  -- Tottenham Hotspur
  ((SELECT id FROM teams WHERE name = 'Tottenham Hotspur'), 'tot'),
  ((SELECT id FROM teams WHERE name = 'Tottenham Hotspur'), 'spurs'),
  
  -- Turkey
  ((SELECT id FROM teams WHERE name = 'Turkey'), 'tur'),
  
  -- Uruguay
  ((SELECT id FROM teams WHERE name = 'Uruguay'), 'uru'),
  
  -- USA
  ((SELECT id FROM teams WHERE name = 'USA'), 'usa'),
  
  -- Uzbekistan
  ((SELECT id FROM teams WHERE name = 'Uzbekistan'), 'uzb'),
  
  -- West Ham United
  ((SELECT id FROM teams WHERE name = 'West Ham United'), 'whu'),
  ((SELECT id FROM teams WHERE name = 'West Ham United'), 'hammers'),
  
  -- Wolves
  ((SELECT id FROM teams WHERE name = 'Wolves'), 'wol'),
  ((SELECT id FROM teams WHERE name = 'Wolves'), 'wlv')
ON CONFLICT (team_id, alias) DO NOTHING;