function export_data()
%EXPORT_DATA Export current processed results for a public data viewer.
% Run from RateEffects: addpath('github'); export_data
root = fileparts(fileparts(mfilename('fullpath')));
addpath(root,fullfile(root,'Subscripts'));
src = fullfile(root,'Processed data and results');
out = fullfile(root,'github','data');
for folder = ["shear","compression","parameters"]
    if ~isfolder(fullfile(out,folder)), mkdir(fullfile(out,folder)); end
end
cfg = triax_test_config();
master = readtable(fullfile(src,'master_rate_effects_table.csv'),'TextType','string');
materialColumns = {'SoilComposition','Family','K_pct','B_pct','SW_pct','wL_pct','Gs','CF_pct'};
materials = unique(master(:,materialColumns),'rows','stable');
writetable(materials,fullfile(out,'materials.csv'));
tests = cfg(:,{'LabID','TestID','HasRadialDrainage'});
tests.MaterialID = strings(height(cfg),1);
tests.NominalConsolidationPressure_kPa = nan(height(cfg),1);
tests.OCR = nan(height(cfg),1);
tests.HasMaterialMetadata = false(height(cfg),1);
tests.ComplianceCorrectionApplied = false(height(cfg),1);
tests.Gs_Input = nan(height(cfg),1);
tests.InitialVoidRatioCorrected = nan(height(cfg),1);
tests.FinalVoidRatioCorrected = nan(height(cfg),1);
tests.VoidRatioCorrection = nan(height(cfg),1);
tests.EndConsolidationPressure_kPa = nan(height(cfg),1);
tests.ShearRows = zeros(height(cfg),1);
tests.CompressionPoints = zeros(height(cfg),1);
tests.ShearFile = strings(height(cfg),1);
tests.CompressionFile = strings(height(cfg),1);
provenance = table(strings(0,1),strings(0,1),zeros(0,1),strings(0,1), ...
    'VariableNames',{'SourceFile','ModifiedLocal','Bytes','SHA256'});
for i = 1:height(cfg)
    id = cfg.LabID(i);
    files = id + ["_shear.mat","_voidratio.mat","_t_100.mat"];
    for f = files
        assert(isfile(fullfile(src,f)), 'Missing source: %s', f);
        provenance = [provenance; source_info(src,f)]; %#ok<AGROW>
    end
    S = load(fullfile(src,files(1)),'shear_data'); T = S.shear_data;
    V = load(fullfile(src,files(2)),'resultsTable'); v = V.resultsTable;
    C = load(fullfile(src,files(3)),'t100_table'); c = C.t100_table;
    assert(height(v)==1,'Expected one void-ratio result per test.');
    applied = is_compliance_correction_applied(T);
    eps = T.ShearStrain_pct; q = T.corrDevStress_kPa; p = T.Eff_CambridgeP_kPa;
    if applied
        eps = T.ShearStrain_corr_pct; q = T.corrDevStress_corr_kPa;
        p = T.RadialPressure_kPa + q/3 - T.PorePressure_kPa;
    end
    valid = isfinite(eps)&isfinite(q)&isfinite(p)&isfinite(T.PorePressure_kPa)&p>0;
    first = find(valid,1);
    assert(~isempty(first),'No plottable shear data: %s',id);
    correction = v.e_f_eq51-v.e_f_volumeChange;
    n = height(T);
    rate = nan(n,1);
    if ismember('StrainRate',T.Properties.VariableNames), rate = T.StrainRate; end
    shear = table((1:n)',T.StageNumber,T.TimeSinceStartOfTest_s,T.TimeSinceStartOfStage_s, ...
        eps,q,p,T.PorePressure_kPa,T.PorePressure_kPa-T.PorePressure_kPa(first), ...
        T.SpecificVolume-1,T.SpecificVolume-1+correction,rate, ...
        T.ShearStrain_pct,T.corrDevStress_kPa,T.Eff_CambridgeP_kPa,valid, ...
        'VariableNames',{'SourceRow','StageNumber','TimeSinceStartOfTest_s','TimeSinceStartOfStage_s', ...
        'ShearStrain_pct','q_kPa','p_eff_kPa','PorePressure_kPa','ExcessPorePressure_kPa', ...
        'VoidRatioUnshifted','VoidRatioCorrected','AxialStrainRate_pct_min', ...
        'ShearStrainBeforeCompliance_pct','qBeforeCompliance_kPa','pEffBeforeCompliance_kPa','PlotValid'});
    tests.ShearFile(i) = "shear/"+id+".csv";
    writetable(shear,fullfile(out,tests.ShearFile(i)));
    ok = isfinite(c.IL_StageNumber)&c.IL_StageNumber>=1& ...
        isfinite(c.EffCambridgeP_kPa)&c.EffCambridgeP_kPa>0& ...
        isfinite(c.SpecificVolume+correction)&c.SpecificVolume+correction>0;
    c = sortrows(c(ok,:),'IL_StageNumber');
    compression = table(c.StageNumber,c.IL_StageNumber,repmat("t100",height(c),1), ...
        c.EffCambridgeP_kPa,c.SpecificVolume-1,c.SpecificVolume-1+correction, ...
        'VariableNames',{'StageNumber','ILStageNumber','PointType','p_eff_kPa','VoidRatioUnshifted','VoidRatioCorrected'});
    if isfinite(v.p_0)&&v.p_0>0&&isfinite(v.e_i_eq421+correction)&&1+v.e_i_eq421+correction>0
        initial = table(cfg.Stages{i}(2),0,"initial",v.p_0,v.e_i_eq421,v.e_i_eq421+correction, ...
            'VariableNames',compression.Properties.VariableNames);
        compression = [initial;compression];
    end
    tests.CompressionFile(i) = "compression/"+id+".csv";
    writetable(compression,fullfile(out,tests.CompressionFile(i)));
    tests.ComplianceCorrectionApplied(i)=applied;
    tests.Gs_Input(i)=v.Gs_Input;
    tests.InitialVoidRatioCorrected(i)=v.e_i_eq421+correction;
    tests.FinalVoidRatioCorrected(i)=v.e_f_eq51;
    tests.VoidRatioCorrection(i)=correction;
    tests.EndConsolidationPressure_kPa(i)=v.p_c;
    tests.ShearRows(i)=n;
    tests.CompressionPoints(i)=height(compression);
    m = find(master.LabID==id);
    assert(numel(m)<=1,'Duplicate metadata: %s',id);
    if ~isempty(m)
        tests.MaterialID(i)=master.SoilComposition(m);
        tests.NominalConsolidationPressure_kPa(i)=master.pc_kPa(m);
        tests.OCR(i)=master.OCR(m);
        tests.HasMaterialMetadata(i)=true;
    end
    % Check written values and row counts against the source, including NaNs.
    roundtrip=readtable(fullfile(out,tests.ShearFile(i)));
    assert(height(roundtrip)==n);
    for field = {'ShearStrain_pct','q_kPa','p_eff_kPa','VoidRatioCorrected'}
        a=shear.(field{1}); b=roundtrip.(field{1});
        assert(isequal(isnan(a),isnan(b)));
        finite=isfinite(a); assert(all(abs(a(finite)-b(finite))<=1e-10.*max(1,abs(a(finite)))));
    end
    fprintf('%s: %d shear rows, %d compression points, compliance=%d\n',id,n,height(compression),applied);
end
writetable(tests,fullfile(out,'tests.csv'));
parameterFiles = ["master_rate_effects_table.csv","Paper_specimen_rate_effect_parameters.csv", ...
    "Paper_gamma_excluded_stages.csv"];
for f = parameterFiles
    copyfile(fullfile(src,f),fullfile(out,'parameters',f));
    provenance = [provenance;source_info(src,f)]; %#ok<AGROW>
end
writetable(provenance,fullfile(out,'provenance.csv'));
manifest.schema_version = '1.0';
manifest.generated_utc = char(datetime('now','TimeZone','UTC','Format',"yyyy-MM-dd'T'HH:mm:ss'Z'"));
manifest.data_kind = 'processed experimental data; no raw acquisition files';
manifest.tests_table = 'tests.csv';
manifest.materials_table = 'materials.csv';
manifest.provenance_table = 'provenance.csv';
manifest.parameter_files = cellstr("parameters/"+parameterFiles);
manifest.tests = table2struct(tests);
manifest.missing_material_metadata = cellstr(tests.LabID(~tests.HasMaterialMetadata));
manifest.plots = struct('q_strain',{{'ShearStrain_pct','q_kPa'}}, ...
    'q_p',{{'p_eff_kPa','q_kPa'}},'pwp_strain',{{'ShearStrain_pct','ExcessPorePressure_kPa'}}, ...
    'compression',{{'p_eff_kPa','VoidRatioCorrected'}});
fid=fopen(fullfile(out,'manifest.json'),'w'); assert(fid>=0);
cleanup=onCleanup(@()fclose(fid));
fprintf(fid,'%s\n',jsonencode(manifest,'PrettyPrint',true));
fprintf('Exported %d tests and %d measurement rows.\n',height(tests),sum(tests.ShearRows));
end

function row = source_info(root,name)
path=fullfile(root,name); info=dir(path);
fid=fopen(path,'rb'); assert(fid>=0); cleanup=onCleanup(@()fclose(fid));
bytes=fread(fid,Inf,'*uint8');
md=java.security.MessageDigest.getInstance('SHA-256'); md.update(bytes);
hash=lower(reshape(dec2hex(typecast(md.digest(),'uint8'),2).',1,[]));
row=table("Processed data and results/"+name,string(info.date),info.bytes,string(hash), ...
    'VariableNames',{'SourceFile','ModifiedLocal','Bytes','SHA256'});
end
