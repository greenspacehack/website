
	# Publish GeoJSON to directory

	require 'json'
	require 'pp'

	prefixes = {
		"AC"=>"Access",
		"R" =>"Recreational facilities",
		"AM"=>"Amenities",
		"NA"=>"Aesthetics - natural features",
		"NN"=>"Aesthetics - non-natural features",
		"SA"=>"Surrounding area",
		"IN"=>"Incivilities",
		"US"=>"Usability"
	}

	# Read survey file
	# Each value is a hash containing:
	# question:		The question asked
	# answer:		Array of possible answers
	# answer_values:Optional array of answer values (if answers are "1","2","3")
	# answer_type:	Optional "multiple"/"freeform"
	survey  = JSON.parse(File.read("src/data/survey.json"))
	linkage = JSON.parse(File.read("src/data/attachments_linkage.geojson"))['features']
	ordering= JSON.parse(File.read("src/data/ordering.json"))
	sites   = JSON.parse(File.read("src/data/greenspace_hack.geojson"))['features']

	output_features = []
	page_list = {}
	ordering.each do |town,groups|
		page_list[town] = []
		groups.each do |group|
			name = group[0]
			puts "#{town}: #{name}"

			# Group all features for this park
			comp = group.dup.map(&:downcase)
			features = sites.select { |f| comp.include?(f['properties']['gsname'].downcase) }
			keys = features.inject([]) { |arr,f| arr | f['properties'].keys }
			
			# Create file
			fn = name.downcase.gsub(/[^a-z0-9]+/,'_')
			outfile = File.open("src/directory/#{fn}.html","w")
			page_list[town] << [fn, name]
			outfile << "<h2>#{name}</h2>"

			# Iterate through all keys
			header = false
			keys.each do |k|
				# Skip unless it's in the survey list
				# EditDate, Editor, objectid, globalid, gssite, gsname, gsassessor, gsdaytime, gsstartAuto, gsendAuto, gsweather, gscomment, CreationDate, Creator
				next unless survey[k]

				# Find category prefix
				category = prefixes.find { |pr,_| k.start_with?(pr) }
				category = category.nil? ? nil : category[1]
				if header!=category
					outfile << "</div>" unless header==false
					header = category
					outfile << "<div class='survey_section'>"
					outfile << "<h3>#{header}</h3>" unless header.nil?
				end

				# Format question and answer
				s = survey[k]
				q = s['question']; next if q.nil?
				all_answers = features.collect { |f| f['properties'][k] }.uniq
				all_answers.map! { |v| s['answer_values'] ? s['answer_values'][v.to_i-1] : v }
				all_answers.map! { |v| v.gsub('_',' ') unless v.nil? }
				outfile << "<div class='question'><span>#{q}:</span><span>#{all_answers.join('; ')}</span></div>"
			end
			if features.length>1
				outfile << "<p><i>Where more than one value is recorded for a category, these are the values input by different assessors.</i></p>"
			end
			outfile << "</div>" # close survey_section
			
			# Images
			globals = features.collect { |f| f['properties']['globalid'] }
			images = linkage.select { |l| globals.include?(l['properties']['parentglobalid']) }.collect { |l| l['properties']['objectid']-2 }.reject { |i| i<1 }
			unless images.empty?
				outfile << "<div class='images'>"
				images.each do |im|
					outfile << "<img src='/greenspace_images/#{im}.jpg' onclick=\"enlargeImage('/greenspace_images/#{im}.jpg')\" >"
				end
				outfile << "</div>"
				outfile << "<div id='modal' onclick='dismissModal()'></div>"
			end

			# Map
			lon,lat = features[0]['geometry']['coordinates']
			outfile << "<div id='site_map' class='automap' data-ll='#{lat},#{lon}'></div>"

			# GeoJSON output
			output_features << {
				type: 'Feature',
				properties: { name: name, url: "/directory/#{fn}.html" },
				geometry: { type: 'Point', coordinates: [lon,lat] }
			}
			outfile.close
		end
	end

	# Output list of pages
	f = File.open("src/directory/index.html","w")
	page_list.each do |town,sites|
		f << "<h2>#{town}</h2>"
		f << "<ul id='site_list'>"
		sites.each do |pg|
			fn,name = pg
			f << "<li><a href='#{fn}.html'>#{name}</a>"
		end
		f << "</ul>"
	end
	f.close

	# Output GeoJSON index
	geojson = { type: 'FeatureCollection', features: output_features }
	File.write("src/data/map_index.geojson", geojson.to_json)
