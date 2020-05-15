
	# Static site builder
	# Call with: ruby site_builder.rb /path/to/source/files /path/to/build/target

	# Each directory (or, at least, the root) should have a _template.json:
	# { "index.html": {
	#     "before": ["header.html","headline.html"]
	#     "after": ["footer.html"] },
	#   "*.md": {
	#     "before": ["header.html"],
	#     "after": ["footer.html"] }
	# }
	# All files not matched are simply copied across

	# Any .md and .erb files are interpreted as ERBs with a common context for that page
	# Since the main partial is interpreted first, you can use this to set variables for the others:
	# <% set[ hero: "image.jpg" ] %>
	# or just embed files directly:
	# <% embed[ "/includes/test.erb" ] %>

	source, target = ARGV
	builder = SiteBuilder.new(target)
	builder.walk(source)

BEGIN {

require 'redcarpet'
require 'fileutils'
require 'json'
require 'erubis'
	
class CustomRenderer < Redcarpet::Render::HTML
	attr_accessor :context
	def preprocess(full_document)
		full_document = super(full_document) if defined?(super)
		full_document = Erubis::Eruby.new(full_document).result(@context)
		full_document
	end
end

class SiteBuilder

	def initialize(target)
		@renderer = CustomRenderer.new
		@markdown = Redcarpet::Markdown.new(@renderer, autolink: true)
		@target = target
		@default_template = {}
	end

	# Walk the source directory (dir is relative to root, which is static)
	# and parse then write out all files
	def walk(root,dir='')
		# Should read template from file (or use default from root)
		template_path = File.join(root,dir,"_template.json")
		if File.exist?(template_path)
			template = JSON.parse(File.read(template_path))
			if dir=='' then @default_template=template end
		else
			template = @default_template
		end

		FileUtils.mkdir_p(File.join(@target,dir))
		Dir.foreach(File.join(root,dir)) do |fn|
			next if fn=~/^\.+$/ || fn=='_template.json'
			path = File.join(root,dir,fn)
			target_path = File.join(@target,dir,fn)
			if File.directory?(path) then walk(root,File.join(dir,fn)); next end
			match,gen = template.find { |wildcard,gen| File.fnmatch?(wildcard,fn) }
			if match
				# Render all partials in order
				@renderer.context = { 
					embed: ->(file) { render(root,dir,file) },
					set: ->(hash) { @renderer.context.merge!(hash) }
				}
				partial = render(root,dir,fn)
				unless @renderer.context[:title]
					title = fn
					if partial=~/<h\d>(.+?)<\/h\d>/ then title=$1 end
					@renderer.context[:title] = title
				end
				output  = (gen['before'] || []).collect { |fr| render(root,dir,fr) }.join('')
				output += partial
				output += (gen['after' ] || []).collect { |fr| render(root,dir,fr) }.join('')
				target_path.gsub!(/\.\w+/,'.html')
				File.write(target_path, output)
			else
				if !File.exist?(target_path) ||
					File.size(path)!=File.size(target_path) ||
					File.mtime(target_path)<File.mtime(path)
				  FileUtils.copy(path, target_path)
				end
			end
		end
	end

	# Read a partial and return it as HTML (parsing from Markdown if necessary)
	def render(root,dir,fn)
		# If it has < in it, it's probably just a snippet
		if fn.include?("<") then return fn end

		# Read file
		path = fn.start_with?('/') ? File.join(root,fn) : File.join(root,dir,fn)
		if !File.exist?(path) then puts "Couldn't find #{path}"; return "" end
		str = File.read(path)

		# Render
		fn.end_with?('.md') ? @markdown.render(str) : 
			fn.end_with?('.erb') ? Erubis::Eruby.new(str).result(@renderer.context) : 
			str
	end
end
}
