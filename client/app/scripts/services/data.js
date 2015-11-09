
homeApp.factory('dataService', function () {

	var baseIcon = 'icomoon';
	var icons =
	{
		directory: 'icon-folder',
		file: 'icon-file-empty',
		txt:'icon-file-text2',
		avi:'icon-file-play',
		mp3:'icon-file-music',
		jpeg:'icon-image',
		jpg: 'icon-image',
		png: 'icon-image',
		mp4: 'icon-file-play',
		share:'icon-share',
		download:'icon-cloud-download',
		encrypt:'icon-lock',
		details:'icon-zoom-in',
		up:'icon-arrow-up',
		upload:'icon-cloud-upload',
		configuration:'icon-cog',
		search:'icon-search',
		delete: 'icon-bin',
		exit: 'icon-exit',
		home:'icon-home',
		back:'icon-undo2',
		checkmark:'icon-checkmark',
		upload2:'icon-arrow-up',
		cross:'icon-cancel-circle',
		magnet:'icon-magnet',
		folderPlus: 'icon-folder-plus',
		pdf: 'icon-file-pdf',
		zip: 'icon-file-zip',
		rar: 'icon-file-zip',
		shared: 'icon-users',
		canEdit:'icon-quill',
		canView:'icon-eye',
		owns: 'icon-user',
		move: 'icon-arrow-left',
		link: 'icon-link',
		rename:'icon-pencil'
	};


return {
	getIcon: function (resource)
	{
		var kind = "";
		if (resource.resource_kind === 'file') {
			var file_name = resource.name.split("."); // Fallará si más de un . en el nombre
			kind = file_name[file_name.length - 1];
		}
		else if (resource.resource_kind === 'directory') {
			kind = "directory";
		}
		else {
			kind = resource;
		}
		var icon = icons[kind] || icons['file'];
		return baseIcon + " " + icon;
	},
	messages:
	{
		PUBLIC_LINK : "¿Estás seguro? Cualquiera con el enlace podrá acceder al archivo",
		DELETE_RESOURCE: "¿Estás seguro de que deseas borrar este archivo?",
	}
}
});
